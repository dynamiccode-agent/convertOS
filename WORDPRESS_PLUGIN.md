# ConvertOS WordPress Connector Plugin

Complete WordPress plugin template for sending webhook events to ConvertOS.

## Installation Structure

```
convertos-connector/
├── convertos-connector.php           # Main plugin file
├── includes/
│   ├── class-convertos-connector.php # Core plugin class
│   ├── class-utm-tracker.php         # UTM parameter tracking
│   ├── class-webhook-sender.php      # Webhook HTTP client
│   └── class-event-logger.php        # Event logging
├── admin/
│   ├── settings.php                  # Admin settings page
│   └── assets/
│       ├── css/admin.css
│       └── js/admin.js
└── readme.txt
```

## Main Plugin File: `convertos-connector.php`

```php
<?php
/**
 * Plugin Name: ConvertOS Connector
 * Plugin URI: https://convertos.cloud
 * Description: Send lead, order, and checkout events to ConvertOS for unified analytics
 * Version: 1.0.0
 * Author: ConvertOS
 * Author URI: https://convertos.cloud
 * License: GPL v2 or later
 * Text Domain: convertos-connector
 * Requires PHP: 7.4
 * Requires at least: 5.8
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

define('CONVERTOS_VERSION', '1.0.0');
define('CONVERTOS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CONVERTOS_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include required files
require_once CONVERTOS_PLUGIN_DIR . 'includes/class-utm-tracker.php';
require_once CONVERTOS_PLUGIN_DIR . 'includes/class-webhook-sender.php';
require_once CONVERTOS_PLUGIN_DIR . 'includes/class-event-logger.php';
require_once CONVERTOS_PLUGIN_DIR . 'includes/class-convertos-connector.php';

// Initialize plugin
function convertos_init() {
    $convertos = new ConvertOS_Connector();
    $convertos->init();
}
add_action('plugins_loaded', 'convertos_init');

// Activation hook
register_activation_hook(__FILE__, array('ConvertOS_Connector', 'activate'));

// Deactivation hook
register_deactivation_hook(__FILE__, array('ConvertOS_Connector', 'deactivate'));
```

## Core Plugin Class: `includes/class-convertos-connector.php`

```php
<?php

class ConvertOS_Connector {
    
    private $utm_tracker;
    private $webhook_sender;
    private $event_logger;
    
    public function init() {
        $this->utm_tracker = new ConvertOS_UTM_Tracker();
        $this->webhook_sender = new ConvertOS_Webhook_Sender();
        $this->event_logger = new ConvertOS_Event_Logger();
        
        // Initialize UTM tracking
        add_action('init', array($this->utm_tracker, 'capture_utm_params'));
        
        // Hook into form submissions (for leads)
        add_action('wpcf7_mail_sent', array($this, 'handle_contact_form_submission')); // Contact Form 7
        add_action('gform_after_submission', array($this, 'handle_gravity_form_submission'), 10, 2); // Gravity Forms
        add_action('elementor_pro/forms/new_record', array($this, 'handle_elementor_form_submission'), 10, 2); // Elementor
        
        // Hook into WooCommerce orders
        add_action('woocommerce_new_order', array($this, 'handle_order_created'), 10, 1);
        add_action('woocommerce_payment_complete', array($this, 'handle_order_paid'), 10, 1);
        add_action('woocommerce_order_refunded', array($this, 'handle_order_refunded'), 10, 1);
        
        // Hook into FunnelKit checkout events
        add_action('wfacp_after_checkout_page_found', array($this, 'handle_checkout_started'), 10, 1);
        add_action('wfacp_after_order_processed', array($this, 'handle_checkout_completed'), 10, 1);
        add_action('cartflows_cart_abandoned', array($this, 'handle_checkout_abandoned'), 10, 1);
        
        // Admin settings page
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }
    
    // Lead: Contact Form 7
    public function handle_contact_form_submission($contact_form) {
        $submission = WPCF7_Submission::get_instance();
        
        if (!$submission) return;
        
        $posted_data = $submission->get_posted_data();
        
        $event_data = array(
            'event_id' => wp_generate_uuid4(),
            'event_type' => 'lead.created',
            'timestamp' => gmdate('c'), // ISO8601 UTC
            'data' => array(
                'name' => isset($posted_data['your-name']) ? $posted_data['your-name'] : '',
                'email' => isset($posted_data['your-email']) ? $posted_data['your-email'] : '',
                'phone' => isset($posted_data['your-phone']) ? $posted_data['your-phone'] : '',
                'registration_type' => 'free',
                'form_name' => $contact_form->title(),
                'campaign_name' => null,
                'utm_source' => $this->utm_tracker->get_utm('source'),
                'utm_medium' => $this->utm_tracker->get_utm('medium'),
                'utm_campaign' => $this->utm_tracker->get_utm('campaign'),
                'utm_content' => $this->utm_tracker->get_utm('content'),
                'utm_term' => $this->utm_tracker->get_utm('term'),
                'referrer' => $this->utm_tracker->get_referrer(),
                'landing_page' => $this->utm_tracker->get_landing_page(),
                'fbclid' => $this->utm_tracker->get_fbclid(),
                'gclid' => $this->utm_tracker->get_gclid(),
            ),
        );
        
        $this->webhook_sender->send($event_data);
        $this->event_logger->log('lead.created', $event_data);
    }
    
    // Order: Created
    public function handle_order_created($order_id) {
        $order = wc_get_order($order_id);
        
        if (!$order) return;
        
        $event_data = array(
            'event_id' => wp_generate_uuid4(),
            'event_type' => 'order.created',
            'timestamp' => gmdate('c'),
            'data' => array(
                'order_id' => (string)$order->get_id(),
                'total' => (string)$order->get_total(),
                'currency' => $order->get_currency(),
                'status' => $order->get_status(),
                'payment_method' => $order->get_payment_method(),
                'coupon_code' => implode(',', $order->get_coupon_codes()),
                'customer_email' => $order->get_billing_email(),
                'customer_name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'customer_phone' => $order->get_billing_phone(),
                'utm_source' => $order->get_meta('_utm_source'),
                'utm_medium' => $order->get_meta('_utm_medium'),
                'utm_campaign' => $order->get_meta('_utm_campaign'),
                'utm_content' => $order->get_meta('_utm_content'),
                'utm_term' => $order->get_meta('_utm_term'),
                'referrer' => $order->get_meta('_referrer'),
                'fbclid' => $order->get_meta('_fbclid'),
                'gclid' => $order->get_meta('_gclid'),
                'origin_source' => $order->get_meta('_wc_order_attribution_source_type'),
                'funnel_id' => $order->get_meta('_cartflows_funnel_id'),
                'checkout_id' => $order->get_meta('_wfacp_checkout_id'),
            ),
        );
        
        $this->webhook_sender->send($event_data);
        $this->event_logger->log('order.created', $event_data);
    }
    
    // Order: Paid
    public function handle_order_paid($order_id) {
        $order = wc_get_order($order_id);
        
        if (!$order) return;
        
        $event_data = array(
            'event_id' => wp_generate_uuid4(),
            'event_type' => 'order.paid',
            'timestamp' => gmdate('c'),
            'data' => array(
                'order_id' => (string)$order->get_id(),
                'total' => (string)$order->get_total(),
                'currency' => $order->get_currency(),
                'status' => 'paid',
                'payment_method' => $order->get_payment_method(),
                'coupon_code' => implode(',', $order->get_coupon_codes()),
                'customer_email' => $order->get_billing_email(),
                'customer_name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'customer_phone' => $order->get_billing_phone(),
                'utm_source' => $order->get_meta('_utm_source'),
                'utm_medium' => $order->get_meta('_utm_medium'),
                'utm_campaign' => $order->get_meta('_utm_campaign'),
                'utm_content' => $order->get_meta('_utm_content'),
                'utm_term' => $order->get_meta('_utm_term'),
                'referrer' => $order->get_meta('_referrer'),
                'fbclid' => $order->get_meta('_fbclid'),
                'gclid' => $order->get_meta('_gclid'),
                'origin_source' => $order->get_meta('_wc_order_attribution_source_type'),
                'funnel_id' => $order->get_meta('_cartflows_funnel_id'),
                'checkout_id' => $order->get_meta('_wfacp_checkout_id'),
            ),
        );
        
        $this->webhook_sender->send($event_data);
        $this->event_logger->log('order.paid', $event_data);
    }
    
    // Order: Refunded
    public function handle_order_refunded($order_id) {
        $order = wc_get_order($order_id);
        
        if (!$order) return;
        
        $event_data = array(
            'event_id' => wp_generate_uuid4(),
            'event_type' => 'order.refunded',
            'timestamp' => gmdate('c'),
            'data' => array(
                'order_id' => (string)$order->get_id(),
                'total' => (string)$order->get_total(),
                'currency' => $order->get_currency(),
                'customer_email' => $order->get_billing_email(),
            ),
        );
        
        $this->webhook_sender->send($event_data);
        $this->event_logger->log('order.refunded', $event_data);
    }
    
    // Checkout: Started
    public function handle_checkout_started($checkout_id) {
        $event_data = array(
            'event_id' => wp_generate_uuid4(),
            'event_type' => 'checkout.started',
            'timestamp' => gmdate('c'),
            'data' => array(
                'funnel_id' => get_post_meta($checkout_id, '_cartflows_funnel_id', true),
                'checkout_id' => (string)$checkout_id,
                'step' => '1',
                'email' => isset($_POST['billing_email']) ? sanitize_email($_POST['billing_email']) : null,
                'phone' => isset($_POST['billing_phone']) ? sanitize_text_field($_POST['billing_phone']) : null,
                'utm_source' => $this->utm_tracker->get_utm('source'),
                'utm_medium' => $this->utm_tracker->get_utm('medium'),
                'utm_campaign' => $this->utm_tracker->get_utm('campaign'),
                'utm_content' => $this->utm_tracker->get_utm('content'),
                'utm_term' => $this->utm_tracker->get_utm('term'),
                'referrer' => $this->utm_tracker->get_referrer(),
            ),
        );
        
        $this->webhook_sender->send($event_data);
        $this->event_logger->log('checkout.started', $event_data);
    }
    
    // Checkout: Abandoned
    public function handle_checkout_abandoned($cart_data) {
        $event_data = array(
            'event_id' => wp_generate_uuid4(),
            'event_type' => 'checkout.abandoned',
            'timestamp' => gmdate('c'),
            'data' => array(
                'funnel_id' => isset($cart_data['funnel_id']) ? $cart_data['funnel_id'] : null,
                'checkout_id' => isset($cart_data['checkout_id']) ? $cart_data['checkout_id'] : null,
                'email' => isset($cart_data['email']) ? $cart_data['email'] : null,
                'phone' => isset($cart_data['phone']) ? $cart_data['phone'] : null,
                'utm_source' => $this->utm_tracker->get_utm('source'),
                'utm_medium' => $this->utm_tracker->get_utm('medium'),
                'utm_campaign' => $this->utm_tracker->get_utm('campaign'),
                'utm_content' => $this->utm_tracker->get_utm('content'),
                'utm_term' => $this->utm_tracker->get_utm('term'),
                'referrer' => $this->utm_tracker->get_referrer(),
            ),
        );
        
        $this->webhook_sender->send($event_data);
        $this->event_logger->log('checkout.abandoned', $event_data);
    }
    
    // Admin menu
    public function add_admin_menu() {
        add_options_page(
            'ConvertOS Settings',
            'ConvertOS',
            'manage_options',
            'convertos-settings',
            array($this, 'settings_page')
        );
    }
    
    // Register settings
    public function register_settings() {
        register_setting('convertos_settings', 'convertos_webhook_url');
        register_setting('convertos_settings', 'convertos_connection_id');
        register_setting('convertos_settings', 'convertos_connection_secret');
        register_setting('convertos_settings', 'convertos_enable_logging');
    }
    
    // Settings page
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
            
            <h2>Test Connection</h2>
            <button type="button" id="convertos-test-connection" class="button">Send Test Event</button>
            <div id="convertos-test-result" style="margin-top: 10px;"></div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            $('#convertos-test-connection').on('click', function() {
                var $button = $(this);
                var $result = $('#convertos-test-result');
                
                $button.prop('disabled', true).text('Testing...');
                $result.html('<p>Sending test event...</p>');
                
                $.ajax({
                    url: ajaxurl,
                    method: 'POST',
                    data: {
                        action: 'convertos_test_connection'
                    },
                    success: function(response) {
                        if (response.success) {
                            $result.html('<p style="color: green;">✓ Connection successful!</p>');
                        } else {
                            $result.html('<p style="color: red;">✗ Connection failed: ' + response.data + '</p>');
                        }
                    },
                    error: function() {
                        $result.html('<p style="color: red;">✗ Request failed</p>');
                    },
                    complete: function() {
                        $button.prop('disabled', false).text('Send Test Event');
                    }
                });
            });
        });
        </script>
        <?php
    }
    
    public static function activate() {
        // Create event log table
        global $wpdb;
        $table_name = $wpdb->prefix . 'convertos_event_log';
        
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            event_type varchar(50) NOT NULL,
            event_id varchar(100) NOT NULL,
            status varchar(20) NOT NULL,
            response text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY event_id (event_id),
            KEY event_type (event_type),
            KEY created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    public static function deactivate() {
        // Clean up scheduled events if any
    }
}
```

## UTM Tracker: `includes/class-utm-tracker.php`

```php
<?php

class ConvertOS_UTM_Tracker {
    
    private $utm_params = array('source', 'medium', 'campaign', 'content', 'term');
    private $session_key = 'convertos_utm_data';
    
    public function capture_utm_params() {
        if (!session_id()) {
            session_start();
        }
        
        // Capture UTM parameters
        foreach ($this->utm_params as $param) {
            $key = 'utm_' . $param;
            if (isset($_GET[$key]) && !empty($_GET[$key])) {
                $_SESSION[$this->session_key][$key] = sanitize_text_field($_GET[$key]);
            }
        }
        
        // Capture fbclid and gclid
        if (isset($_GET['fbclid']) && !empty($_GET['fbclid'])) {
            $_SESSION[$this->session_key]['fbclid'] = sanitize_text_field($_GET['fbclid']);
        }
        
        if (isset($_GET['gclid']) && !empty($_GET['gclid'])) {
            $_SESSION[$this->session_key]['gclid'] = sanitize_text_field($_GET['gclid']);
        }
        
        // Capture referrer (first visit only)
        if (!isset($_SESSION[$this->session_key]['referrer']) && !empty($_SERVER['HTTP_REFERER'])) {
            $referrer = esc_url_raw($_SERVER['HTTP_REFERER']);
            $site_url = get_site_url();
            
            // Only save external referrers
            if (strpos($referrer, $site_url) !== 0) {
                $_SESSION[$this->session_key]['referrer'] = $referrer;
            }
        }
        
        // Capture landing page (first visit only)
        if (!isset($_SESSION[$this->session_key]['landing_page'])) {
            $_SESSION[$this->session_key]['landing_page'] = esc_url_raw($_SERVER['REQUEST_URI']);
        }
        
        // Save to order meta on checkout
        add_action('woocommerce_checkout_update_order_meta', array($this, 'save_utm_to_order'), 10, 1);
    }
    
    public function get_utm($param) {
        if (!session_id()) {
            session_start();
        }
        
        $key = 'utm_' . $param;
        return isset($_SESSION[$this->session_key][$key]) ? $_SESSION[$this->session_key][$key] : null;
    }
    
    public function get_fbclid() {
        if (!session_id()) {
            session_start();
        }
        
        return isset($_SESSION[$this->session_key]['fbclid']) ? $_SESSION[$this->session_key]['fbclid'] : null;
    }
    
    public function get_gclid() {
        if (!session_id()) {
            session_start();
        }
        
        return isset($_SESSION[$this->session_key]['gclid']) ? $_SESSION[$this->session_key]['gclid'] : null;
    }
    
    public function get_referrer() {
        if (!session_id()) {
            session_start();
        }
        
        return isset($_SESSION[$this->session_key]['referrer']) ? $_SESSION[$this->session_key]['referrer'] : null;
    }
    
    public function get_landing_page() {
        if (!session_id()) {
            session_start();
        }
        
        return isset($_SESSION[$this->session_key]['landing_page']) ? $_SESSION[$this->session_key]['landing_page'] : null;
    }
    
    public function save_utm_to_order($order_id) {
        if (!session_id()) {
            session_start();
        }
        
        if (!isset($_SESSION[$this->session_key])) {
            return;
        }
        
        $order = wc_get_order($order_id);
        
        foreach ($this->utm_params as $param) {
            $key = 'utm_' . $param;
            if (isset($_SESSION[$this->session_key][$key])) {
                $order->update_meta_data('_' . $key, $_SESSION[$this->session_key][$key]);
            }
        }
        
        if (isset($_SESSION[$this->session_key]['fbclid'])) {
            $order->update_meta_data('_fbclid', $_SESSION[$this->session_key]['fbclid']);
        }
        
        if (isset($_SESSION[$this->session_key]['gclid'])) {
            $order->update_meta_data('_gclid', $_SESSION[$this->session_key]['gclid']);
        }
        
        if (isset($_SESSION[$this->session_key]['referrer'])) {
            $order->update_meta_data('_referrer', $_SESSION[$this->session_key]['referrer']);
        }
        
        $order->save();
    }
}
```

## Webhook Sender: `includes/class-webhook-sender.php`

```php
<?php

class ConvertOS_Webhook_Sender {
    
    public function send($event_data) {
        $webhook_url = get_option('convertos_webhook_url');
        $connection_id = get_option('convertos_connection_id');
        $connection_secret = get_option('convertos_connection_secret');
        
        if (empty($webhook_url) || empty($connection_id) || empty($connection_secret)) {
            error_log('[ConvertOS] Webhook settings not configured');
            return false;
        }
        
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
        
        if (is_wp_error($response)) {
            error_log('[ConvertOS] Webhook failed: ' . $response->get_error_message());
            return false;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code >= 200 && $status_code < 300) {
            error_log('[ConvertOS] Webhook sent successfully: ' . $event_data['event_id']);
            return true;
        } else {
            error_log('[ConvertOS] Webhook failed with status ' . $status_code . ': ' . $body);
            return false;
        }
    }
}
```

## Event Logger: `includes/class-event-logger.php`

```php
<?php

class ConvertOS_Event_Logger {
    
    public function log($event_type, $event_data) {
        if (!get_option('convertos_enable_logging')) {
            return;
        }
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'convertos_event_log';
        
        $wpdb->insert(
            $table_name,
            array(
                'event_type' => $event_type,
                'event_id' => $event_data['event_id'],
                'status' => 'sent',
                'response' => wp_json_encode($event_data),
                'created_at' => current_time('mysql'),
            ),
            array('%s', '%s', '%s', '%s', '%s')
        );
    }
}
```

## Installation Instructions (for WordPress users)

1. **Download the plugin** from ConvertOS dashboard
2. **Upload to WordPress**: Plugins → Add New → Upload Plugin
3. **Activate** the plugin
4. **Configure settings**: Settings → ConvertOS
   - Paste Webhook URL
   - Paste Connection ID
   - Paste Connection Secret
5. **Test connection**: Click "Send Test Event"
6. **UTMs will be automatically tracked** on all pages
7. **Events will be sent** on:
   - Form submissions (leads)
   - New orders (WooCommerce)
   - Paid orders
   - Checkout started/abandoned (FunnelKit)

## Event Payload Examples

### Lead Created
```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "lead.created",
  "timestamp": "2026-02-16T06:00:00Z",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "registration_type": "free",
    "form_name": "Contact Form",
    "utm_source": "facebook",
    "utm_medium": "cpc",
    "utm_campaign": "spring_sale",
    "utm_content": "ad1",
    "utm_term": "fitness",
    "referrer": "https://facebook.com",
    "landing_page": "/",
    "fbclid": "IwAR123...",
    "gclid": null
  }
}
```

### Order Paid
```json
{
  "event_id": "660e9500-f39c-52e5-b827-557766551111",
  "event_type": "order.paid",
  "timestamp": "2026-02-16T06:05:00Z",
  "data": {
    "order_id": "12345",
    "total": "99.00",
    "currency": "USD",
    "status": "paid",
    "payment_method": "stripe",
    "coupon_code": "SAVE10",
    "customer_email": "jane@example.com",
    "customer_name": "Jane Smith",
    "customer_phone": "+0987654321",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "winter_promo",
    "referrer": "https://google.com",
    "fbclid": null,
    "gclid": "Cj0KCQ...",
    "origin_source": "Paid Ads",
    "funnel_id": "123",
    "checkout_id": "456"
  }
}
```

### Checkout Abandoned
```json
{
  "event_id": "770f0600-g40d-63f6-c938-668877662222",
  "event_type": "checkout.abandoned",
  "timestamp": "2026-02-16T06:10:00Z",
  "data": {
    "funnel_id": "123",
    "checkout_id": "456",
    "email": "user@example.com",
    "phone": "+1122334455",
    "utm_source": "email",
    "utm_medium": "newsletter",
    "utm_campaign": "weekly_update",
    "referrer": null
  }
}
```

## Requirements

- WordPress 5.8+
- PHP 7.4+
- WooCommerce 5.0+ (for order events)
- FunnelKit / CartFlows (optional, for checkout events)
- Contact Form 7 / Gravity Forms / Elementor (optional, for lead events)

## Security Notes

- Connection secret is stored in WordPress database (encrypted at rest)
- HMAC SHA-256 signature validation on all webhooks
- SSL/TLS required for webhook endpoint
- Event IDs prevent duplicate processing
- No sensitive data logged unless explicitly enabled

## Support

For issues or questions:
- Email: support@convertos.cloud
- Documentation: https://docs.convertos.cloud
