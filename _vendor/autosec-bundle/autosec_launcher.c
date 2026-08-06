#include <furi.h>
#include <furi_hal.h>
#include <gui/gui.h>
#include <gui/elements.h>
#include <gui/view_dispatcher.h>
#include <gui/modules/submenu.h>
#include <gui/modules/dialog_ex.h>
#include <gui/modules/widget.h>
#include <storage/storage.h>
#include <notification/notification.h>
#include <notification/notification_messages.h>

#define TAG "AutoSecLauncher"
#define LAUNCHER_LOG_FILE_PATH EXT_PATH("autosec_launcher.log")

typedef enum {
    LauncherViewSubmenu,
    LauncherViewAbout,
    LauncherViewStatus,
    LauncherViewTools,
} LauncherView;

typedef enum {
    SubmenuIndexAutosecTool,
    SubmenuIndexCanMonitor,
    SubmenuIndexMarauderCompanion,
    SubmenuIndexESP32Flasher,
    SubmenuIndexAbout,
} SubmenuIndex;

typedef struct {
    ViewDispatcher* view_dispatcher;
    Submenu* submenu;
    Widget* widget;
    NotificationApp* notifications;
    
    uint32_t autosec_enabled;
    uint32_t can_enabled;
    uint32_t marauder_enabled;
    uint32_t esp32_enabled;
} LauncherApp;

// Forward declarations
static void launcher_draw_about(Canvas* canvas, LauncherApp* app);
static void launcher_draw_status(Canvas* canvas, LauncherApp* app);
static void launcher_draw_tools(Canvas* canvas, LauncherApp* app);

// Submenu callback
static void launcher_submenu_callback(void* context, uint32_t index) {
    LauncherApp* app = (LauncherApp*)context;
    
    switch(index) {
        case SubmenuIndexAutosecTool:
            // Launch AutoSec Tool
            furi_record_close(RECORD_NOTIFICATION);
            furi_record_close(RECORD_GUI);
            notification_message(app->notifications, &sequence_success);
            break;
            
        case SubmenuIndexCanMonitor:
            // Launch CAN Monitor
            notification_message(app->notifications, &sequence_success);
            break;
            
        case SubmenuIndexMarauderCompanion:
            // Launch Marauder Companion
            notification_message(app->notifications, &sequence_success);
            break;
            
        case SubmenuIndexESP32Flasher:
            // Show ESP32 flasher interface
            view_dispatcher_switch_to_view(app->view_dispatcher, LauncherViewTools);
            break;
            
        case SubmenuIndexAbout:
            view_dispatcher_switch_to_view(app->view_dispatcher, LauncherViewAbout);
            break;
    }
}

// About view callback
static void launcher_about_view_callback(Canvas* canvas, void* context) {
    LauncherApp* app = (LauncherApp*)context;
    launcher_draw_about(canvas, app);
}

// Status view callback
static void launcher_status_view_callback(Canvas* canvas, void* context) {
    LauncherApp* app = (LauncherApp*)context;
    launcher_draw_status(canvas, app);
}

// Tools view callback
static void launcher_tools_view_callback(Canvas* canvas, void* context) {
    LauncherApp* app = (LauncherApp*)context;
    launcher_draw_tools(canvas, app);
}

// Input callback for about
static void launcher_about_input_callback(InputEvent* event, void* context) {
    LauncherApp* app = (LauncherApp*)context;
    
    if(event->type == InputTypePress && event->key == InputKeyBack) {
        view_dispatcher_switch_to_view(app->view_dispatcher, LauncherViewSubmenu);
    }
}

// Input callback for tools
static void launcher_tools_input_callback(InputEvent* event, void* context) {
    LauncherApp* app = (LauncherApp*)context;
    
    if(event->type == InputTypePress && event->key == InputKeyBack) {
        view_dispatcher_switch_to_view(app->view_dispatcher, LauncherViewSubmenu);
    }
}

// Draw about view
static void launcher_draw_about(Canvas* canvas, LauncherApp* app) {
    UNUSED(app);
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "AutoSec Launcher");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 35, "Comprehensive Automotive");
    canvas_draw_str(canvas, 10, 50, "Security Research Suite");
    
    canvas_draw_str(canvas, 10, 70, "Version: 1.0.0");
    canvas_draw_str(canvas, 10, 85, "Author: Koko");
    canvas_draw_str(canvas, 10, 100, "Authorized testing only");
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK");
}

// Draw status view
static void launcher_draw_status(Canvas* canvas, LauncherApp* app) {
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "System Status");
    
    canvas_set_font(canvas, FontSecondary);
    
    // Draw status indicators
    canvas_draw_str(canvas, 10, 35, "AutoSec Tool:");
    canvas_draw_str(canvas, 120, 35, app->autosec_enabled ? "OK" : "N/A");
    
    canvas_draw_str(canvas, 10, 50, "CAN Monitor:");
    canvas_draw_str(canvas, 120, 50, app->can_enabled ? "OK" : "N/A");
    
    canvas_draw_str(canvas, 10, 65, "Marauder:");
    canvas_draw_str(canvas, 120, 65, app->marauder_enabled ? "OK" : "N/A");
    
    canvas_draw_str(canvas, 10, 80, "ESP32 Flasher:");
    canvas_draw_str(canvas, 120, 80, app->esp32_enabled ? "OK" : "N/A");
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK");
}

// Draw tools view
static void launcher_draw_tools(Canvas* canvas, LauncherApp* app) {
    UNUSED(app);
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "Available Tools");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 35, "1. AutoSec Tool");
    canvas_draw_str(canvas, 15, 50, "Sub-GHz scanning & analysis");
    
    canvas_draw_str(canvas, 10, 65, "2. CAN Monitor");
    canvas_draw_str(canvas, 15, 80, "CAN bus message capture");
    
    canvas_draw_str(canvas, 10, 95, "3. Marauder Companion");
    canvas_draw_str(canvas, 15, 110, "WiFi/BLE/GPS auditing");
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK");
}

// Application allocation
static LauncherApp* launcher_app_alloc(void) {
    LauncherApp* app = malloc(sizeof(LauncherApp));
    
    // Create view dispatcher
    app->view_dispatcher = view_dispatcher_alloc();
    
    // Create submenu
    app->submenu = submenu_alloc();
    submenu_add_item(app->submenu, "AutoSec Tool", SubmenuIndexAutosecTool, launcher_submenu_callback, app);
    submenu_add_item(app->submenu, "CAN Monitor", SubmenuIndexCanMonitor, launcher_submenu_callback, app);
    submenu_add_item(app->submenu, "Marauder Companion", SubmenuIndexMarauderCompanion, launcher_submenu_callback, app);
    submenu_add_item(app->submenu, "ESP32 Flasher", SubmenuIndexESP32Flasher, launcher_submenu_callback, app);
    submenu_add_item(app->submenu, "About", SubmenuIndexAbout, launcher_submenu_callback, app);
    
    // Create widget
    app->widget = widget_alloc();
    
    // Initialize state
    app->autosec_enabled = 1;
    app->can_enabled = 1;
    app->marauder_enabled = 1;
    app->esp32_enabled = 1;
    
    // Get notification service
    app->notifications = furi_record_open(RECORD_NOTIFICATION);
    
    // Register views
    view_dispatcher_add_view(app->view_dispatcher, LauncherViewSubmenu, submenu_get_view(app->submenu));
    
    // Create custom views
    View* about_view = view_alloc();
    view_set_draw_callback(about_view, launcher_about_view_callback);
    view_set_input_callback(about_view, launcher_about_input_callback);
    view_set_context(about_view, app);
    view_dispatcher_add_view(app->view_dispatcher, LauncherViewAbout, about_view);
    
    View* status_view = view_alloc();
    view_set_draw_callback(status_view, launcher_status_view_callback);
    view_set_context(status_view, app);
    view_dispatcher_add_view(app->view_dispatcher, LauncherViewStatus, status_view);
    
    View* tools_view = view_alloc();
    view_set_draw_callback(tools_view, launcher_tools_view_callback);
    view_set_input_callback(tools_view, launcher_tools_input_callback);
    view_set_context(tools_view, app);
    view_dispatcher_add_view(app->view_dispatcher, LauncherViewTools, tools_view);
    
    // Set initial view
    view_dispatcher_switch_to_view(app->view_dispatcher, LauncherViewSubmenu);
    
    // Get GUI
    Gui* gui = furi_record_open(RECORD_GUI);
    view_dispatcher_attach_to_gui(app->view_dispatcher, gui);
    
    return app;
}

// Application deallocation
static void launcher_app_free(LauncherApp* app) {
    view_dispatcher_remove_view(app->view_dispatcher, LauncherViewSubmenu);
    view_dispatcher_remove_view(app->view_dispatcher, LauncherViewAbout);
    view_dispatcher_remove_view(app->view_dispatcher, LauncherViewStatus);
    view_dispatcher_remove_view(app->view_dispatcher, LauncherViewTools);
    
    submenu_free(app->submenu);
    widget_free(app->widget);
    view_dispatcher_free(app->view_dispatcher);
    
    furi_record_close(RECORD_NOTIFICATION);
    furi_record_close(RECORD_GUI);
    free(app);
}

// Main application entry point
int32_t autosec_launcher_app(void* p) {
    UNUSED(p);
    LauncherApp* app = launcher_app_alloc();
    view_dispatcher_run(app->view_dispatcher);
    launcher_app_free(app);
    return 0;
}
