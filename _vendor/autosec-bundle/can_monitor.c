#include <furi.h>
#include <furi_hal.h>
#include <gui/gui.h>
#include <gui/elements.h>
#include <gui/view_dispatcher.h>
#include <gui/modules/submenu.h>
#include <gui/modules/text_box.h>
#include <gui/modules/widget.h>
#include <storage/storage.h>

#define TAG "CANMonitor"
#define CAN_LOG_FILE_PATH EXT_PATH("can_log.txt")
#define MAX_CAN_MESSAGES 100

typedef enum {
    CANViewSubmenu,
    CANViewMonitor,
    CANViewAnalysis,
    CANViewAbout,
} CANView;

typedef enum {
    CANSubmenuIndexMonitor,
    CANSubmenuIndexAnalysis,
    CANSubmenuIndexAbout,
} CANSubmenuIndex;

typedef struct {
    uint32_t can_id;
    uint8_t dlc;
    uint8_t data[8];
    uint32_t timestamp;
} CANMessage;

typedef struct {
    ViewDispatcher* view_dispatcher;
    Submenu* submenu;
    TextBox* text_box;
    Widget* widget;
    
    CANMessage messages[MAX_CAN_MESSAGES];
    uint32_t message_count;
    bool is_monitoring;
    uint32_t total_messages;
} CANApp;

// Forward declarations
static void can_app_draw_monitor(Canvas* canvas, CANApp* app);
static void can_app_draw_analysis(Canvas* canvas, CANApp* app);
static void can_app_draw_about(Canvas* canvas, CANApp* app);

// Submenu callback
static void can_submenu_callback(void* context, uint32_t index) {
    CANApp* app = (CANApp*)context;
    
    switch(index) {
        case CANSubmenuIndexMonitor:
            view_dispatcher_switch_to_view(app->view_dispatcher, CANViewMonitor);
            app->is_monitoring = true;
            break;
        case CANSubmenuIndexAnalysis:
            view_dispatcher_switch_to_view(app->view_dispatcher, CANViewAnalysis);
            break;
        case CANSubmenuIndexAbout:
            view_dispatcher_switch_to_view(app->view_dispatcher, CANViewAbout);
            break;
    }
}

// Monitor view callback
static void can_monitor_view_callback(Canvas* canvas, void* context) {
    CANApp* app = (CANApp*)context;
    can_app_draw_monitor(canvas, app);
}

// Analysis view callback
static void can_analysis_view_callback(Canvas* canvas, void* context) {
    CANApp* app = (CANApp*)context;
    can_app_draw_analysis(canvas, app);
}

// About view callback
static void can_about_view_callback(Canvas* canvas, void* context) {
    CANApp* app = (CANApp*)context;
    can_app_draw_about(canvas, app);
}

// Input callback for monitor
static void can_monitor_input_callback(InputEvent* event, void* context) {
    CANApp* app = (CANApp*)context;
    
    if(event->type == InputTypePress) {
        if(event->key == InputKeyBack) {
            app->is_monitoring = false;
            view_dispatcher_switch_to_view(app->view_dispatcher, CANViewSubmenu);
        }
    }
}

// Input callback for analysis
static void can_analysis_input_callback(InputEvent* event, void* context) {
    CANApp* app = (CANApp*)context;
    
    if(event->type == InputTypePress) {
        if(event->key == InputKeyBack) {
            view_dispatcher_switch_to_view(app->view_dispatcher, CANViewSubmenu);
        }
    }
}

// Input callback for about
static void can_about_input_callback(InputEvent* event, void* context) {
    CANApp* app = (CANApp*)context;
    
    if(event->type == InputTypePress) {
        if(event->key == InputKeyBack) {
            view_dispatcher_switch_to_view(app->view_dispatcher, CANViewSubmenu);
        }
    }
}

// Draw monitor view
static void can_app_draw_monitor(Canvas* canvas, CANApp* app) {
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "CAN Bus Monitor");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str_aligned(canvas, 64, 30, AlignCenter, AlignCenter, "500 kbps");
    
    if(app->is_monitoring) {
        canvas_draw_str_aligned(canvas, 64, 50, AlignCenter, AlignCenter, "MONITORING...");
        canvas_draw_str_aligned(canvas, 64, 65, AlignCenter, AlignCenter, 
                               furi_string_get_cstr(furi_string_alloc_printf("Messages: %lu", app->total_messages)));
    } else {
        canvas_draw_str_aligned(canvas, 64, 50, AlignCenter, AlignCenter, "STOPPED");
    }
    
    // Display last few messages
    if(app->message_count > 0) {
        CANMessage* last = &app->messages[app->message_count - 1];
        canvas_draw_str_aligned(canvas, 64, 85, AlignCenter, AlignCenter, 
                               furi_string_get_cstr(furi_string_alloc_printf("ID: 0x%03lX", last->can_id)));
        canvas_draw_str_aligned(canvas, 64, 100, AlignCenter, AlignCenter, 
                               furi_string_get_cstr(furi_string_alloc_printf("DLC: %d", last->dlc)));
    }
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK to exit");
}

// Draw analysis view
static void can_app_draw_analysis(Canvas* canvas, CANApp* app) {
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "CAN Analysis");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str_aligned(canvas, 64, 35, AlignCenter, AlignCenter, 
                           furi_string_get_cstr(furi_string_alloc_printf("Total: %lu", app->total_messages)));
    canvas_draw_str_aligned(canvas, 64, 50, AlignCenter, AlignCenter, 
                           furi_string_get_cstr(furi_string_alloc_printf("Buffered: %lu", app->message_count)));
    
    if(app->message_count > 0) {
        uint32_t min_id = 0xFFF;
        uint32_t max_id = 0x000;
        
        for(uint32_t i = 0; i < app->message_count; i++) {
            if(app->messages[i].can_id < min_id) min_id = app->messages[i].can_id;
            if(app->messages[i].can_id > max_id) max_id = app->messages[i].can_id;
        }
        
        canvas_draw_str_aligned(canvas, 64, 70, AlignCenter, AlignCenter, 
                               furi_string_get_cstr(furi_string_alloc_printf("ID Range: 0x%03lX-0x%03lX", min_id, max_id)));
    }
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK to exit");
}

// Draw about view
static void can_app_draw_about(Canvas* canvas, CANApp* app) {
    UNUSED(app);
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 10, 15, "CAN Monitor v1.0");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 35, "Vehicle CAN Bus");
    canvas_draw_str(canvas, 10, 50, "Monitoring Tool");
    
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 10, 70, "Requires ESP32 with");
    canvas_draw_str(canvas, 10, 85, "CAN transceiver");
    canvas_draw_str(canvas, 10, 100, "Authorized testing only");
    
    canvas_draw_str_aligned(canvas, 64, 120, AlignCenter, AlignCenter, "Press BACK to exit");
}

// Application allocation
static CANApp* can_app_alloc(void) {
    CANApp* app = malloc(sizeof(CANApp));
    
    // Create view dispatcher
    app->view_dispatcher = view_dispatcher_alloc();
    
    // Create submenu
    app->submenu = submenu_alloc();
    submenu_add_item(app->submenu, "Monitor", CANSubmenuIndexMonitor, can_submenu_callback, app);
    submenu_add_item(app->submenu, "Analysis", CANSubmenuIndexAnalysis, can_submenu_callback, app);
    submenu_add_item(app->submenu, "About", CANSubmenuIndexAbout, can_submenu_callback, app);
    
    // Create text box
    app->text_box = text_box_alloc();
    
    // Create widget for custom drawing
    app->widget = widget_alloc();
    
    // Initialize state
    app->message_count = 0;
    app->is_monitoring = false;
    app->total_messages = 0;
    memset(app->messages, 0, sizeof(app->messages));
    
    // Register views
    view_dispatcher_add_view(app->view_dispatcher, CANViewSubmenu, submenu_get_view(app->submenu));
    
    // Create custom views for monitor and analysis
    View* monitor_view = view_alloc();
    view_set_draw_callback(monitor_view, can_monitor_view_callback);
    view_set_input_callback(monitor_view, can_monitor_input_callback);
    view_set_context(monitor_view, app);
    view_dispatcher_add_view(app->view_dispatcher, CANViewMonitor, monitor_view);
    
    View* analysis_view = view_alloc();
    view_set_draw_callback(analysis_view, can_analysis_view_callback);
    view_set_input_callback(analysis_view, can_analysis_input_callback);
    view_set_context(analysis_view, app);
    view_dispatcher_add_view(app->view_dispatcher, CANViewAnalysis, analysis_view);
    
    View* about_view = view_alloc();
    view_set_draw_callback(about_view, can_about_view_callback);
    view_set_input_callback(about_view, can_about_input_callback);
    view_set_context(about_view, app);
    view_dispatcher_add_view(app->view_dispatcher, CANViewAbout, about_view);
    
    // Set initial view
    view_dispatcher_switch_to_view(app->view_dispatcher, CANViewSubmenu);
    
    // Get GUI
    Gui* gui = furi_record_open(RECORD_GUI);
    view_dispatcher_attach_to_gui(app->view_dispatcher, gui);
    
    return app;
}

// Application deallocation
static void can_app_free(CANApp* app) {
    view_dispatcher_remove_view(app->view_dispatcher, CANViewSubmenu);
    view_dispatcher_remove_view(app->view_dispatcher, CANViewMonitor);
    view_dispatcher_remove_view(app->view_dispatcher, CANViewAnalysis);
    view_dispatcher_remove_view(app->view_dispatcher, CANViewAbout);
    
    submenu_free(app->submenu);
    text_box_free(app->text_box);
    widget_free(app->widget);
    view_dispatcher_free(app->view_dispatcher);
    furi_record_close(RECORD_GUI);
    free(app);
}

// Main application entry point
int32_t can_monitor_app(void* p) {
    UNUSED(p);
    CANApp* app = can_app_alloc();
    view_dispatcher_run(app->view_dispatcher);
    can_app_free(app);
    return 0;
}
