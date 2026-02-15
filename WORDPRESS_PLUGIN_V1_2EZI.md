# ConvertOS WordPress Plugin - V1 for 2EZi (Minimal Implementation)

## ⚠️ V1 Scope: Base Member Campaign ONLY

Before building the full plugin, we need to identify 2EZi's actual lead capture mechanism.

## 🔍 Discovery Questions for 2EZi

**1. What captures "Base Member" leads?**
- [ ] FunnelKit opt-in form
- [ ] WooCommerce registration
- [ ] Contact Form 7
- [ ] Gravity Forms
- [ ] Elementor Forms
- [ ] Custom form plugin: ___________
- [ ] Other: ___________

**2. Where is the form located?**
- [ ] Homepage
- [ ] Dedicated landing page: ___________
- [ ] Checkout page
- [ ] Multiple pages

**3. What data is captured?**
- [ ] Email only
- [ ] Email + Name
- [ ] Email + Name + Phone
- [ ] Other fields: ___________

**4. Are UTM parameters already being tracked?**
- [ ] Yes (by what?: ___________)
- [ ] No
- [ ] Unknown

## 📦 Minimal V1 Plugin Structure

Once we know the form plugin, build ONLY that integration:

### Example: If 2EZi uses FunnelKit Opt-in

```php
<?php
/**
 * Plugin Name: ConvertOS Connector - 2EZi Edition
 * Version: 1.0.0-2ezi
 * Description: Sends Base Member leads to ConvertOS
 */

// Core includes
require_once 'includes/class-utm-tracker.php';
require_once 'includes/class-webhook-sender.php';

class ConvertOS_2EZi_Connector {
    
    private $utm_tracker;
    private $webhook_sender;
    
    public function init() {
        $this->utm_tracker = new ConvertOS_UTM_Tracker();
        $this->webhook_sender = new ConvertOS_Webhook_Sender();
        
        // Initialize UTM tracking
        add_action('init', array($this->utm_tracker, 'capture_utm_params'));
        
        // ONLY hook into the specific lead source
        add_action('wfacp_after_optin_form_submitted', array($this, 'handle_funnel_kit_optin'), 10, 1);
        
        // Admin settings
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }
    
    // FunnelKit opt-in handler
    public function handle_funnel_kit_optin($optin_data) {
        $event_data = array(
            'event_id' => wp_generate_uuid4(),
            'event_type' => 'lead.created',
            'timestamp' => gmdate('c'),
            'data' => array(
                'name' => isset($optin_data['name']) ? $optin_data['name'] : '',
                'email' => isset($optin_data['email']) ? $optin_data['email'] : '',
                'phone' => isset($optin_data['phone']) ? $optin_data['phone'] : '',
                'registration_type' => 'base',
                'form_name' => 'Base Member Opt-in',
                'campaign_name' => 'Base Member Campaign',
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
    }
    
    // ... (settings page methods same as full plugin)
}

// Initialize
function convertos_2ezi_init() {
    $connector = new ConvertOS_2EZi_Connector();
    $connector->init();
}
add_action('plugins_loaded', 'convertos_2ezi_init');
```

### UTM Tracker & Webhook Sender

**Use the same classes from main plugin template** (`WORDPRESS_PLUGIN.md`):
- `class-utm-tracker.php` (no changes)
- `class-webhook-sender.php` (no changes)

### Admin Settings Page

**Use the same settings page from main plugin template** (no changes needed).

## 🧪 V1 Testing Flow

1. **Local testing first**:
   ```bash
   # Create test connection
   curl -X POST http://localhost:3000/api/connections \
     -H "Content-Type: application/json" \
     -d '{
       "clientId": "<2ezi-client-id>",
       "type": "wordpress",
       "name": "2EZi WP (Staging)",
       "domain": "staging.2ezi.com"
     }'
   ```

2. **Install on staging WordPress**:
   - Install plugin
   - Configure credentials
   - Submit test form
   - Verify in ConvertOS:
     ```bash
     curl http://localhost:3000/api/connections/<id>/events
     ```

3. **Verify data flow**:
   - Check `WebhookEvent` table (raw payload stored)
   - Check `Lead` table (normalized record)
   - Check `Contact` table (aggregated)
   - Check UTM parameters captured correctly

4. **Only after staging success → deploy to 2ezi.com**

## 🚫 What to SKIP in V1

**Don't implement these yet**:
- ❌ WooCommerce order tracking (until lead tracking proven)
- ❌ Multiple form plugins (just 2EZi's actual form)
- ❌ FunnelKit checkout events (not needed for lead tracking)
- ❌ Event logging table (use webhook events API instead)
- ❌ Multiple connection support (just 2EZi hardcoded is fine for V1)

**V1 Goal**: Capture 1 type of event (Base Member leads) reliably.

## ✅ V1 Acceptance Criteria

**Must work**:
1. ✅ UTM parameters captured on landing
2. ✅ Form submission triggers webhook
3. ✅ HMAC signature validates
4. ✅ Event stored in `WebhookEvent`
5. ✅ Lead created in `Lead` table
6. ✅ Contact created/updated in `Contact` table
7. ✅ Idempotency works (duplicate event_id ignored)
8. ✅ Events visible in connections UI

**Can be broken**:
- Orders (not implemented yet)
- Other form types (not implemented yet)
- Admin UI polish (basic is fine)

## 📋 Pre-Build Checklist

Before building ANY WordPress plugin code:

- [ ] Identify 2EZi's exact form plugin/hook
- [ ] Identify exact field names (email, name, phone)
- [ ] Test form on staging site
- [ ] Confirm hook fires (add temporary logging)
- [ ] Extract exact data structure from hook
- [ ] Build minimal plugin for THAT HOOK ONLY

## 🎯 Next Steps

1. **Tyler**: Answer discovery questions above
2. **Atlas**: Build minimal V1 plugin for that specific form
3. **Test**: On staging WordPress (not 2ezi.com)
4. **Verify**: Data flows correctly
5. **Deploy**: To 2ezi.com only after staging success

---

**DO NOT ship a generic plugin with 10 form integrations if 2EZi only uses 1.**

Build for reality, not theory.
