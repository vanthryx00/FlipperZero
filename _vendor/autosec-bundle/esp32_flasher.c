#include <furi.h>
#include <furi_hal.h>
#include <gui/gui.h>
#include <gui/elements.h>
#include <gui/view_dispatcher.h>
#include <gui/modules/submenu.h>
#include <gui/modules/text_input.h>
#include <gui/modules/widget.h>
#include <storage/storage.h>
#include <notification/notification.h>
#include <notification/notification_messages.h>

#define TAG "ESP32Flasher"
#define FLASHER_LOG_FILE_PATH EXT_PATH("esp32_flasher.log")

typedef enum {
    FlasherViewSubmenu,
    FlasherViewFlashing,
    FlasherViewStatus,
    FlasherViewAbout,
} FlasherView;

typedef enum {
    SubmenuIndexFlashMarauder,
    SubmenuIndexFlashFirmware,
    SubmenuIndexVerifyDevice,
    SubmenuIndexAbout,
} SubmenuIndex;

typedef struct {
    ViewDispatcher* view_dispatcher;
    Submenu* submenu;
    Widget* widget;
    NotificationApp* notifications;
    
    uint32_t flash_progress;
    uint32_t total_size;
    uint32_t flashed_size;
    bool is_flashing;
    char status_message[256];
} FlasherApp;

// Forward declarations
static void flasher_draw_flashing(Canvas* canvas, FlasherApp* app);
static void flasher_draw_status(Canvas* canvas, FlasherApp* app);
static void flasher_draw_about(Canvas* canvas, FlasherApp* app);

// Submenu callback
static void flasher_submenu_callback(void* context, uint32_t index) {
    FlasherApp* app = (FlasherApp*)context;
    
    switch(index) {
        case SubmenuIndexFlashMarauder:
            app->is_flashing = true;
            app->flash_progress = 0;
            app->total_size = 1024 * 1024; // 1MB example
            snprintf(app->status_message, sizeof(app->status_message), "Flashing ESP32 Marauder...");
            view_dispatcher_switch_to_view(app->view_dispatcher, FlasherViewFlashing);
            notification_message(app->notifications, &sequence_success);
            break;
            
        case SubmenuIndexFlashFirmware:
            app->is_flashing = true;
            app->flash_progress = 0;
            app->total_size = 512 * 1024; // 512KB example
            snprintf(app->status_message, sizeof(app->status_message), "Flashing Custom Firmware...");
            view_dispatcher_switch_to_view(app->view_dispatcher, FlasherViewFlashing);
            notification_message(app->notifications, &sequence_success);
            break;
            
        case SubmenuIndexVerifyDevice:
            view_dispatcher_switch_to_view(app->view_dispatcher, FlasherViewStatus);
            break;
            
        case SubmenuIndexAbout:
            view_dispatcher_switch_to_view(app->view_dispatcher, FlasherViewAbout);
            break;
    }
}

// Flashing view callback
static void flasher_flashing_view_callback(Canvas* canvas, void* context) {
    FlasherApp* app = (FlasherApp*)context;
    flasher_draw_flashing(canvas, app);
}

// Status view callback
static void flasher_status_view_callback(Canvas* canvas, void* context) {
    FlasherApp* app = (FlasherApp*)context;
    flasher_draw_status(canvas, app);
}

// About view callback
static void flasher_about_view_callback(Canvas* canvas, void* context) {
    FlasherApp* app = (FlasherApp*)context;
    flasher_draw_about(canvas, app);
}

// Input callback for flashing
static void flasher_flashing_input_callback(InputEvent* event, void* context) {
    FlasherApp* app = (FlasherApp*)context;
    
    if(event->type == InputTypePress && event->key == InputKeyBack) {
        app->is_flashing = false;
        view_dispatcher_switch_to_view(app->view_dispatcher, FlasherViewSubmenu);
    }
}

// Input callback for status
static void flasher_status_input_callback(InputEvent* event, void* context) {
    FlasherApp* app = (FlasherApp*)context;
    
    if(event->type == InputTypePress && event->key == InputKeyBack) {
        view_dispatcher_switch_to_view(app->view_dispatcher, FlasherViewSubmenu);
    }
}

// Input callback for about
static void flasher_about_input_callback(InputEvent* event, void* context) {
    FlasherApp* app = (FlasherApp*)context;
    
    if(event->type == InputTypePress && event->key == InputKeyBack) {
        view_dispatcher_switch_to_view(app->view_dispatcher, FlasherViewSubmenu);
    }
}

// Draw flashing view
static void flasher_draw_flashing(Canvas* canvas, FlasherApp* app) {
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "Flashing ESP32");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 35, app->status_message);
    
    // Draw progress bar
    uint32_t progress_percent = (app->flashed_size * 100) / app->total_size;
    uint32_t bar_width = (progress_percent * 100) / 100;
    
    canvas_draw_box(canvas, 10, 55, bar_width, 10);
    canvas_draw_frame(canvas, 10, 55, 108, 10);
    
    // Draw percentage
    char progress_str[32];
    snprintf(progress_str, sizeof(progress_str), "%lu%%", progress_percent);
    canvas_draw_str_aligned(canvas, 64, 75, AlignCenter, AlignCenter, progress_str);
    
    // Draw size info
    char size_str[64];
    snprintf(size_str, sizeof(size_str), "%lu / %lu bytes", app->flashed_size, app->total_size);
    canvas_draw_str_aligned(canvas, 64, 95, AlignCenter, AlignCenter, size_str);
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK to cancel");
}

// Draw status view
static void flasher_draw_status(Canvas* canvas, FlasherApp* app) {
    UNUSED(app);
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "Device Status");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 35, "ESP32 Connection:");
    canvas_draw_str(canvas, 120, 35, "OK");
    
    canvas_draw_str(canvas, 10, 50, "Chip ID:");
    canvas_draw_str(canvas, 120, 50, "ESP32-S3");
    
    canvas_draw_str(canvas, 10, 65, "Flash Size:");
    canvas_draw_str(canvas, 120, 65, "16 MB");
    
    canvas_draw_str(canvas, 10, 80, "MAC Address:");
    canvas_draw_str(canvas, 10, 95, "AA:BB:CC:DD:EE:FF");
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK");
}

// Draw about view
static void flasher_draw_about(Canvas* canvas, FlasherApp* app) {
    UNUSED(app);
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "ESP32 Flasher");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 35, "Firmware Flashing Tool");
    canvas_draw_str(canvas, 10, 50, "for ESP32 Marauder");
    
    canvas_draw_str(canvas, 10, 70, "Version: 1.0.0");
    canvas_draw_str(canvas, 10, 85, "Author: Koko");
    canvas_draw_str(canvas, 10, 100, "Authorized testing only");
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK");
}

// Application allocation
static FlasherApp* flasher_app_alloc(void) {
    FlasherApp* app = malloc(sizeof(FlasherApp));
    
    // Create view dispatcher
    app->view_dispatcher = view_dispatcher_alloc();
    
    // Create submenu
    app->submenu = submenu_alloc();
    submenu_add_item(app->submenu, "Flash Marauder", SubmenuIndexFlashMarauder, flasher_submenu_callback, app);
    submenu_add_item(app->submenu, "Flash Firmware", SubmenuIndexFlashFirmware, flasher_submenu_callback, app);
    submenu_add_item(app->submenu, "Verify Device", SubmenuIndexVerifyDevice, flasher_submenu_callback, app);
    submenu_add_item(app->submenu, "About", SubmenuIndexAbout, flasher_submenu_callback, app);
    
    // Create widget
    app->widget = widget_alloc();
    
    // Initialize state
    app->flash_progress = 0;
    app->total_size = 0;
    app->flashed_size = 0;
    app->is_flashing = false;
    snprintf(app->status_message, sizeof(app->status_message), "Ready");
    
    // Get notification service
    app->notifications = furi_record_open(RECORD_NOTIFICATION);
    
    // Register views
    view_dispatcher_add_view(app->view_dispatcher, FlasherViewSubmenu, submenu_get_view(app->submenu));
    
    // Create custom views
    View* flashing_view = view_alloc();
    view_set_draw_callback(flashing_view, flasher_flashing_view_callback);
    view_set_input_callback(flashing_view, flasher_flashing_input_callback);
    view_set_context(flashing_view, app);
    view_dispatcher_add_view(app->view_dispatcher, FlasherViewFlashing, flashing_view);
    
    View* status_view = view_alloc();
    view_set_draw_callback(status_view, flasher_status_view_callback);
    view_set_input_callback(status_view, flasher_status_input_callback);
    view_set_context(status_view, app);
    view_dispatcher_add_view(app->view_dispatcher, FlasherViewStatus, status_view);
    
    View* about_view = view_alloc();
    view_set_draw_callback(about_view, flasher_about_view_callback);
    view_set_input_callback(about_view, flasher_about_input_callback);
    view_set_context(about_view, app);
    view_dispatcher_add_view(app->view_dispatcher, FlasherViewAbout, about_view);
    
    // Set initial view
    view_dispatcher_switch_to_view(app->view_dispatcher, FlasherViewSubmenu);
    
    // Get GUI
    Gui* gui = furi_record_open(RECORD_GUI);
    view_dispatcher_attach_to_gui(app->view_dispatcher, gui);
    
    return app;
}

// Application deallocation
static void flasher_app_free(FlasherApp* app) {
    view_dispatcher_remove_view(app->view_dispatcher, FlasherViewSubmenu);
    view_dispatcher_remove_view(app->view_dispatcher, FlasherViewFlashing);
    view_dispatcher_remove_view(app->view_dispatcher, FlasherViewStatus);
    view_dispatcher_remove_view(app->view_dispatcher, FlasherViewAbout);
    
    submenu_free(app->submenu);
    widget_free(app->widget);
    view_dispatcher_free(app->view_dispatcher);
    
    furi_record_close(RECORD_NOTIFICATION);
    furi_record_close(RECORD_GUI);
    free(app);
}

// Main application entry point
int32_t esp32_flasher_app(void* p) {
    UNUSED(p);
    FlasherApp* app = flasher_app_alloc();
    view_dispatcher_run(app->view_dispatcher);
    flasher_app_free(app);
    return 0;
}
