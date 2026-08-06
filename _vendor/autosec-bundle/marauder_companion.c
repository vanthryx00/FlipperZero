#include <furi.h>
#include <furi_hal.h>
#include <gui/gui.h>
#include <gui/elements.h>
#include <gui/view_dispatcher.h>
#include <gui/modules/submenu.h>
#include <gui/modules/text_box.h>
#include <gui/modules/widget.h>
#include <storage/storage.h>

#define TAG "MarauderCompanion"
#define MARAUDER_LOG_FILE_PATH EXT_PATH("marauder_log.txt")

typedef enum {
    MarauderViewSubmenu,
    MarauderViewWiFi,
    MarauderViewBluetooth,
    MarauderViewGPS,
    MarauderViewAbout,
} MarauderView;

typedef enum {
    MarauderSubmenuIndexWiFi,
    MarauderSubmenuIndexBluetooth,
    MarauderSubmenuIndexGPS,
    MarauderSubmenuIndexAbout,
} MarauderSubmenuIndex;

typedef struct {
    ViewDispatcher* view_dispatcher;
    Submenu* submenu;
    TextBox* text_box;
    Widget* widget;
    
    uint32_t wifi_networks;
    uint32_t ble_devices;
    uint32_t gps_satellites;
    bool is_scanning;
} MarauderApp;

// Forward declarations
static void marauder_app_draw_wifi(Canvas* canvas, MarauderApp* app);
static void marauder_app_draw_bluetooth(Canvas* canvas, MarauderApp* app);
static void marauder_app_draw_gps(Canvas* canvas, MarauderApp* app);
static void marauder_app_draw_about(Canvas* canvas, MarauderApp* app);

// Submenu callback
static void marauder_submenu_callback(void* context, uint32_t index) {
    MarauderApp* app = (MarauderApp*)context;
    
    switch(index) {
        case MarauderSubmenuIndexWiFi:
            view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewWiFi);
            app->is_scanning = true;
            break;
        case MarauderSubmenuIndexBluetooth:
            view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewBluetooth);
            app->is_scanning = true;
            break;
        case MarauderSubmenuIndexGPS:
            view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewGPS);
            app->is_scanning = true;
            break;
        case MarauderSubmenuIndexAbout:
            view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewAbout);
            break;
    }
}

// WiFi view callback
static void marauder_wifi_view_callback(Canvas* canvas, void* context) {
    MarauderApp* app = (MarauderApp*)context;
    marauder_app_draw_wifi(canvas, app);
}

// Bluetooth view callback
static void marauder_bluetooth_view_callback(Canvas* canvas, void* context) {
    MarauderApp* app = (MarauderApp*)context;
    marauder_app_draw_bluetooth(canvas, app);
}

// GPS view callback
static void marauder_gps_view_callback(Canvas* canvas, void* context) {
    MarauderApp* app = (MarauderApp*)context;
    marauder_app_draw_gps(canvas, app);
}

// About view callback
static void marauder_about_view_callback(Canvas* canvas, void* context) {
    MarauderApp* app = (MarauderApp*)context;
    marauder_app_draw_about(canvas, app);
}

// Input callback for WiFi
static void marauder_wifi_input_callback(InputEvent* event, void* context) {
    MarauderApp* app = (MarauderApp*)context;
    
    if(event->type == InputTypePress) {
        if(event->key == InputKeyBack) {
            app->is_scanning = false;
            view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewSubmenu);
        }
    }
}

// Input callback for Bluetooth
static void marauder_bluetooth_input_callback(InputEvent* event, void* context) {
    MarauderApp* app = (MarauderApp*)context;
    
    if(event->type == InputTypePress) {
        if(event->key == InputKeyBack) {
            app->is_scanning = false;
            view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewSubmenu);
        }
    }
}

// Input callback for GPS
static void marauder_gps_input_callback(InputEvent* event, void* context) {
    MarauderApp* app = (MarauderApp*)context;
    
    if(event->type == InputTypePress) {
        if(event->key == InputKeyBack) {
            app->is_scanning = false;
            view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewSubmenu);
        }
    }
}

// Input callback for About
static void marauder_about_input_callback(InputEvent* event, void* context) {
    MarauderApp* app = (MarauderApp*)context;
    
    if(event->type == InputTypePress) {
        if(event->key == InputKeyBack) {
            view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewSubmenu);
        }
    }
}

// Draw WiFi view
static void marauder_app_draw_wifi(Canvas* canvas, MarauderApp* app) {
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "WiFi Scanner");
    
    canvas_set_font(canvas, FontSecondary);
    
    if(app->is_scanning) {
        canvas_draw_str_aligned(canvas, 64, 40, AlignCenter, AlignCenter, "SCANNING...");
        canvas_draw_str_aligned(canvas, 64, 60, AlignCenter, AlignCenter, 
                               furi_string_get_cstr(furi_string_alloc_printf("Networks: %lu", app->wifi_networks)));
    } else {
        canvas_draw_str_aligned(canvas, 64, 50, AlignCenter, AlignCenter, "STOPPED");
    }
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK to exit");
}

// Draw Bluetooth view
static void marauder_app_draw_bluetooth(Canvas* canvas, MarauderApp* app) {
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "Bluetooth Scanner");
    
    canvas_set_font(canvas, FontSecondary);
    
    if(app->is_scanning) {
        canvas_draw_str_aligned(canvas, 64, 40, AlignCenter, AlignCenter, "SCANNING...");
        canvas_draw_str_aligned(canvas, 64, 60, AlignCenter, AlignCenter, 
                               furi_string_get_cstr(furi_string_alloc_printf("Devices: %lu", app->ble_devices)));
    } else {
        canvas_draw_str_aligned(canvas, 64, 50, AlignCenter, AlignCenter, "STOPPED");
    }
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK to exit");
}

// Draw GPS view
static void marauder_app_draw_gps(Canvas* canvas, MarauderApp* app) {
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "GPS Monitor");
    
    canvas_set_font(canvas, FontSecondary);
    
    if(app->is_scanning) {
        canvas_draw_str_aligned(canvas, 64, 40, AlignCenter, AlignCenter, "ACQUIRING...");
        canvas_draw_str_aligned(canvas, 64, 60, AlignCenter, AlignCenter, 
                               furi_string_get_cstr(furi_string_alloc_printf("Satellites: %lu", app->gps_satellites)));
    } else {
        canvas_draw_str_aligned(canvas, 64, 50, AlignCenter, AlignCenter, "STOPPED");
    }
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK to exit");
}

// Draw about view
static void marauder_app_draw_about(Canvas* canvas, MarauderApp* app) {
    UNUSED(app);
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "Marauder Companion");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 35, "ESP32 Marauder V6.1");
    canvas_draw_str(canvas, 10, 50, "Companion App");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 70, "WiFi/BLE/GPS");
    canvas_draw_str(canvas, 10, 85, "Auditing Tool");
    canvas_draw_str(canvas, 10, 100, "Authorized testing only");
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK to exit");
}

// Application allocation
static MarauderApp* marauder_app_alloc(void) {
    MarauderApp* app = malloc(sizeof(MarauderApp));
    
    // Create view dispatcher
    app->view_dispatcher = view_dispatcher_alloc();
    
    // Create submenu
    app->submenu = submenu_alloc();
    submenu_add_item(app->submenu, "WiFi", MarauderSubmenuIndexWiFi, marauder_submenu_callback, app);
    submenu_add_item(app->submenu, "Bluetooth", MarauderSubmenuIndexBluetooth, marauder_submenu_callback, app);
    submenu_add_item(app->submenu, "GPS", MarauderSubmenuIndexGPS, marauder_submenu_callback, app);
    submenu_add_item(app->submenu, "About", MarauderSubmenuIndexAbout, marauder_submenu_callback, app);
    
    // Create text box
    app->text_box = text_box_alloc();
    
    // Create widget for custom drawing
    app->widget = widget_alloc();
    
    // Initialize state
    app->wifi_networks = 0;
    app->ble_devices = 0;
    app->gps_satellites = 0;
    app->is_scanning = false;
    
    // Register views
    view_dispatcher_add_view(app->view_dispatcher, MarauderViewSubmenu, submenu_get_view(app->submenu));
    
    // Create custom views for WiFi, Bluetooth, and GPS
    View* wifi_view = view_alloc();
    view_set_draw_callback(wifi_view, marauder_wifi_view_callback);
    view_set_input_callback(wifi_view, marauder_wifi_input_callback);
    view_set_context(wifi_view, app);
    view_dispatcher_add_view(app->view_dispatcher, MarauderViewWiFi, wifi_view);
    
    View* bluetooth_view = view_alloc();
    view_set_draw_callback(bluetooth_view, marauder_bluetooth_view_callback);
    view_set_input_callback(bluetooth_view, marauder_bluetooth_input_callback);
    view_set_context(bluetooth_view, app);
    view_dispatcher_add_view(app->view_dispatcher, MarauderViewBluetooth, bluetooth_view);
    
    View* gps_view = view_alloc();
    view_set_draw_callback(gps_view, marauder_gps_view_callback);
    view_set_input_callback(gps_view, marauder_gps_input_callback);
    view_set_context(gps_view, app);
    view_dispatcher_add_view(app->view_dispatcher, MarauderViewGPS, gps_view);
    
    View* about_view = view_alloc();
    view_set_draw_callback(about_view, marauder_about_view_callback);
    view_set_input_callback(about_view, marauder_about_input_callback);
    view_set_context(about_view, app);
    view_dispatcher_add_view(app->view_dispatcher, MarauderViewAbout, about_view);
    
    // Set initial view
    view_dispatcher_switch_to_view(app->view_dispatcher, MarauderViewSubmenu);
    
    // Get GUI
    Gui* gui = furi_record_open(RECORD_GUI);
    view_dispatcher_attach_to_gui(app->view_dispatcher, gui);
    
    return app;
}

// Application deallocation
static void marauder_app_free(MarauderApp* app) {
    view_dispatcher_remove_view(app->view_dispatcher, MarauderViewSubmenu);
    view_dispatcher_remove_view(app->view_dispatcher, MarauderViewWiFi);
    view_dispatcher_remove_view(app->view_dispatcher, MarauderViewBluetooth);
    view_dispatcher_remove_view(app->view_dispatcher, MarauderViewGPS);
    view_dispatcher_remove_view(app->view_dispatcher, MarauderViewAbout);
    
    submenu_free(app->submenu);
    text_box_free(app->text_box);
    widget_free(app->widget);
    view_dispatcher_free(app->view_dispatcher);
    furi_record_close(RECORD_GUI);
    free(app);
}

// Main application entry point
int32_t marauder_companion_app(void* p) {
    UNUSED(p);
    MarauderApp* app = marauder_app_alloc();
    view_dispatcher_run(app->view_dispatcher);
    marauder_app_free(app);
    return 0;
}
