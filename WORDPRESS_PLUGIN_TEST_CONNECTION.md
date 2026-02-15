# WordPress Plugin - Test Connection Implementation

Add this to the WordPress plugin to enable WordPress-side test connection.

## Add AJAX Handler to Main Plugin Class

Add this method to `class-convertos-connector.php`:

```php
public function __construct() {
    // ... existing code ...
    
    // Add AJAX handler for test connection
    add_action('wp_ajax_convertos_test_connection', array($this, 'ajax_test_connection'));
}

/**
 * AJAX handler for test connection button
 * Sends a test.ping event from WordPress to ConvertOS
 */
public function ajax_test_connection() {
    // Check nonce
    check_ajax_referer('convertos_test_connection', 'nonce');
    
    // Check permissions
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Insufficient permissions');
        return;
    }
    
    // Get settings
    $webhook_url = get_option('convertos_webhook_url');
    $connection_id = get_option('convertos_connection_id');
    $connection_secret = get_option('convertos_connection_secret');
    
    // Validate settings
    if (empty($webhook_url) || empty($connection_id) || empty($connection_secret)) {
        wp_send_json_error('Webhook settings not configured. Please fill in all fields and save first.');
        return;
    }
    
    // Generate test event
    $event_data = array(
        'event_id' => wp_generate_uuid4(),
        'event_type' => 'test.ping',
        'timestamp' => gmdate('c'),
        'data' => array(
            'message' => 'Test ping from WordPress admin',
            'test' => true,
            'wordpress_version' => get_bloginfo('version'),
            'plugin_version' => CONVERTOS_VERSION,
            'site_url' => get_site_url(),
        ),
    );
    
    // Convert to JSON
    $payload = wp_json_encode($event_data);
    
    // Generate HMAC signature
    $signature = hash_hmac('sha256', $payload, $connection_secret);
    
    // Send webhook
    $response = wp_remote_post($webhook_url, array(
        'headers' => array(
            'Content-Type' => 'application/json',
            'X-ConvertOS-Connection-Id' => $connection_id,
            'X-ConvertOS-Signature' => $signature,
        ),
        'body' => $payload,
        'timeout' => 15,
    ));
    
    // Handle response
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'Connection failed: ' . $response->get_error_message(),
            'details' => 'Check that the webhook URL is correct and your site can reach ConvertOS.',
        ));
        return;
    }
    
    $status_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $body_data = json_decode($body, true);
    
    if ($status_code >= 200 && $status_code < 300) {
        wp_send_json_success(array(
            'message' => 'Connection successful! Test event received by ConvertOS.',
            'event_id' => $event_data['event_id'],
            'response' => $body_data,
        ));
    } else {
        wp_send_json_error(array(
            'message' => 'Connection failed with status ' . $status_code,
            'details' => isset($body_data['error']) ? $body_data['error'] : $body,
            'status_code' => $status_code,
        ));
    }
}
```

## Update Settings Page JavaScript

Replace the settings page script with this enhanced version:

```php
public function settings_page() {
    ?>
    <div class="wrap">
        <h1>ConvertOS Connector Settings</h1>
        <form method="post" action="options.php">
            <?php
            settings_fields('convertos_settings');
            do_settings_sections('convertos_settings');
            ?>
            <table class="form-table">
                <tr>
                    <th scope="row">Webhook URL</th>
                    <td>
                        <input type="url" name="convertos_webhook_url" 
                               value="<?php echo esc_attr(get_option('convertos_webhook_url')); ?>" 
                               class="regular-text" required />
                        <p class="description">Copy from ConvertOS dashboard</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Connection ID</th>
                    <td>
                        <input type="text" name="convertos_connection_id" 
                               value="<?php echo esc_attr(get_option('convertos_connection_id')); ?>" 
                               class="regular-text" required />
                        <p class="description">Copy from ConvertOS dashboard</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Connection Secret</th>
                    <td>
                        <input type="password" name="convertos_connection_secret" 
                               value="<?php echo esc_attr(get_option('convertos_connection_secret')); ?>" 
                               class="regular-text" required />
                        <p class="description">Copy from ConvertOS dashboard (keep secure!)</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Enable Event Logging</th>
                    <td>
                        <input type="checkbox" name="convertos_enable_logging" 
                               value="1" <?php checked(1, get_option('convertos_enable_logging'), true); ?> />
                        <p class="description">Log events to WordPress debug.log for troubleshooting</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
        
        <hr>
        
        <h2>Test Connection</h2>
        <p>Send a test event to ConvertOS to verify your webhook is configured correctly.</p>
        <button type="button" id="convertos-test-connection" class="button button-secondary">
            <span class="dashicons dashicons-cloud-upload" style="margin-top: 3px;"></span>
            Send Test Event
        </button>
        <div id="convertos-test-result" style="margin-top: 15px;"></div>
    </div>
    
    <style>
        #convertos-test-result .notice {
            padding: 10px 15px;
            margin: 10px 0;
        }
        .convertos-test-details {
            margin-top: 10px;
            padding: 10px;
            background: #f5f5f5;
            border-left: 4px solid #ddd;
            font-family: monospace;
            font-size: 12px;
        }
    </style>
    
    <script>
    jQuery(document).ready(function($) {
        $('#convertos-test-connection').on('click', function() {
            var $button = $(this);
            var $result = $('#convertos-test-result');
            
            // Disable button and show loading
            $button.prop('disabled', true).html('<span class="dashicons dashicons-update-alt spin" style="margin-top: 3px;"></span> Testing...');
            $result.html('<div class="notice notice-info"><p>Sending test event to ConvertOS...</p></div>');
            
            $.ajax({
                url: ajaxurl,
                method: 'POST',
                data: {
                    action: 'convertos_test_connection',
                    nonce: '<?php echo wp_create_nonce('convertos_test_connection'); ?>'
                },
                timeout: 20000, // 20 second timeout
                success: function(response) {
                    if (response.success) {
                        var html = '<div class="notice notice-success">' +
                            '<p><strong>✓ Connection Successful!</strong></p>' +
                            '<p>' + response.data.message + '</p>';
                        
                        if (response.data.event_id) {
                            html += '<div class="convertos-test-details">' +
                                '<strong>Event ID:</strong> ' + response.data.event_id + '<br>' +
                                '<strong>Status:</strong> Received and processed' +
                                '</div>';
                        }
                        
                        html += '</div>';
                        $result.html(html);
                    } else {
                        var html = '<div class="notice notice-error">' +
                            '<p><strong>✗ Connection Failed</strong></p>' +
                            '<p>' + (response.data.message || response.data) + '</p>';
                        
                        if (response.data.details) {
                            html += '<div class="convertos-test-details">' +
                                '<strong>Details:</strong><br>' + response.data.details +
                                '</div>';
                        }
                        
                        html += '<p><strong>Troubleshooting:</strong></p>' +
                            '<ul style="margin-left: 20px;">' +
                            '<li>Verify webhook URL is correct</li>' +
                            '<li>Verify connection ID matches ConvertOS dashboard</li>' +
                            '<li>Verify connection secret matches ConvertOS dashboard</li>' +
                            '<li>Check that your site can make outbound HTTPS requests</li>' +
                            '<li>Check WordPress debug.log for errors</li>' +
                            '</ul>' +
                            '</div>';
                        
                        $result.html(html);
                    }
                },
                error: function(xhr, status, error) {
                    var message = 'Request failed';
                    if (status === 'timeout') {
                        message = 'Request timed out. Check your network connection.';
                    } else if (error) {
                        message = 'Error: ' + error;
                    }
                    
                    $result.html(
                        '<div class="notice notice-error">' +
                        '<p><strong>✗ Connection Error</strong></p>' +
                        '<p>' + message + '</p>' +
                        '<p>Check WordPress debug.log for details.</p>' +
                        '</div>'
                    );
                },
                complete: function() {
                    // Re-enable button
                    $button.prop('disabled', false).html('<span class="dashicons dashicons-cloud-upload" style="margin-top: 3px;"></span> Send Test Event');
                }
            });
        });
    });
    </script>
    
    <style>
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .spin {
            animation: spin 1s linear infinite;
            display: inline-block;
        }
    </style>
    <?php
}
```

## How It Works

### WordPress Side
1. User clicks "Send Test Event" button
2. AJAX request to `wp_ajax_convertos_test_connection`
3. WordPress generates `test.ping` event:
   ```json
   {
     "event_id": "uuid-123",
     "event_type": "test.ping",
     "timestamp": "2026-02-16T06:00:00Z",
     "data": {
       "message": "Test ping from WordPress admin",
       "test": true,
       "wordpress_version": "6.4.2",
       "plugin_version": "1.0.0",
       "site_url": "https://2ezi.com"
     }
   }
   ```
4. WordPress signs with HMAC:
   ```php
   $signature = hash_hmac('sha256', $payload, $secret);
   ```
5. WordPress POSTs to ConvertOS webhook
6. ConvertOS responds with success/error
7. WordPress shows result in admin UI

### ConvertOS Side
1. Receives POST at `/api/webhooks/wordpress`
2. Validates HMAC signature (raw bytes)
3. Checks idempotency
4. Stores in `WebhookEvent` table
5. Processes as `test.ping` (no-op)
6. Returns `200 OK`

### Success Flow
```
WordPress Admin UI
└─> [Send Test Event] button clicked
    └─> AJAX to WordPress backend
        └─> Generate test.ping event
            └─> Sign with HMAC
                └─> POST to ConvertOS webhook
                    └─> ConvertOS validates
                        └─> ConvertOS stores event
                            └─> ConvertOS returns 200 OK
                                └─> WordPress shows "✓ Connection Successful!"
```

### Error Flow
```
WordPress Admin UI
└─> [Send Test Event] button clicked
    └─> AJAX to WordPress backend
        └─> Generate test.ping event
            └─> Sign with HMAC
                └─> POST to ConvertOS webhook
                    └─> ConvertOS returns 401 (Invalid signature)
                        └─> WordPress shows "✗ Connection Failed: Invalid signature"
                            └─> Shows troubleshooting tips
```

## Benefits

✅ **Real environment test**: Tests actual WordPress → ConvertOS connection  
✅ **Validates signing**: Confirms HMAC implementation correct  
✅ **Validates networking**: Confirms firewall/SSL works  
✅ **User-friendly**: Clear success/error messages  
✅ **Troubleshooting**: Provides actionable next steps  
✅ **Idempotent**: Uses unique event_id  
✅ **Logged**: Stored in WebhookEvent table for audit  

## Testing

1. Install WordPress plugin
2. Configure webhook URL, connection ID, secret
3. Click "Send Test Event"
4. Should see "✓ Connection Successful!" with event ID
5. Check ConvertOS:
   ```bash
   curl https://www.convertos.cloud/api/connections/<id>/events
   ```
   Should see `test.ping` event with `signatureValid: true`

## Error Messages

### Invalid Signature
```
✗ Connection Failed
Connection failed with status 401
Details: Invalid signature

Troubleshooting:
- Verify connection secret matches ConvertOS dashboard
- Check for copy/paste errors (no extra spaces)
```

### Connection Timeout
```
✗ Connection Error
Request timed out. Check your network connection.

Troubleshooting:
- Verify webhook URL is correct
- Check firewall allows outbound HTTPS
- Check WordPress can make external requests
```

### Misconfigured
```
✗ Connection Failed
Webhook settings not configured. Please fill in all fields and save first.
```

## Integration with Full Plugin

Add this to the main plugin template (`WORDPRESS_PLUGIN.md`) in the appropriate sections.
