#include <furi.h>
#include <furi_hal.h>
#include <gui/gui.h>
#include <gui/elements.h>
#include <gui/view_dispatcher.h>
#include <gui/modules/submenu.h>
#include <gui/modules/text_box.h>
#include <gui/modules/widget.h>
#include <notification/notification_messages.h>
#include <lib/subghz/subghz_tx_rx_worker.h>
#include <storage/storage.h>

/* 
 * AutoSec Tool - Ultimate x1000 Research Platform + ESP32 CAN Integration
 * Features: Sub-GHz Scanning, Data Logging, Dynamic Emulation, and ESP32 CAN Bus Module.
 */

#define TAG "AutoSec"
#define LOG_FILE_PATH EXT_PATH("autosec_research_log.txt")
#define UART_CH FuriHalUartIdUSART1

typedef enum {
    AutoSecViewSubmenu,
    AutoSecViewAbout,
    AutoSecViewScanner,
    AutoSecViewEmulate,
    AutoSecViewCAN,
} AutoSecView;

typedef enum {
    AutoSecSubmenuIndexScan,
    AutoSecSubmenuIndexEmulate,
    AutoSecSubmenuIndexCAN,
    AutoSecSubmenuIndexAbout,
} AutoSecSubmenuIndex;

typedef struct {
    ViewDispatcher* view_dispatcher;
    Submenu* submenu;
    TextBox* text_box;
    Widget* scanner_widget;
    Widget* emulate_widget;
    Widget* can_widget;
    
    SubGhzTxRxWorker* subghz_worker;
    uint32_t frequency;
    bool is_scanning;
    bool is_emulating;
    bool is_can_active;
    
    FuriString* last_captured_data;
    FuriString* can_log;
} AutoSecApp;

// --- UART Callback for ESP32 Communication ---
static void autosec_uart_callback(UartIrqEvent event, uint8_t data, void* context) {
    AutoSecApp* app = context;
    if(event == UartIrqEventRxDone) {
        furi_string_push_back(app->can_log, data);
        // Limit log size
        if(furi_string_size(app->can_log) > 512) {
            furi_string_right(app->can_log, 256);
        }
    }
}

// --- CAN Bus UI Logic ---
static void autosec_can_widget_draw_callback(Canvas* canvas, void* context) {
    AutoSecApp* app = context;
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str_aligned(canvas, 64, 10, AlignCenter, AlignTop, "ESP32 CAN Sniffer");
    
    canvas_set_font(canvas, FontSecondary);
    if(app->is_can_active) {
        canvas_draw_str_aligned(canvas, 64, 25, AlignCenter, AlignTop, "Monitoring CAN Bus...");
        // Draw last few lines of CAN log
        canvas_draw_str_aligned(canvas, 64, 45, AlignCenter, AlignTop, furi_string_get_cstr(app->can_log));
    } else {
        canvas_draw_str_aligned(canvas, 64, 40, AlignCenter, AlignTop, "Press OK to Start UART");
    }
}

static bool autosec_can_widget_input_callback(InputEvent* event, void* context) {
    AutoSecApp* app = context;
    if(event->type == InputTypeShort && event->key == InputKeyOk) {
        if(!app->is_can_active) {
            app->is_can_active = true;
            furi_hal_uart_set_br(UART_CH, 115200);
            furi_hal_uart_set_irq_cb(UART_CH, autosec_uart_callback, app);
        } else {
            app->is_can_active = false;
            furi_hal_uart_set_irq_cb(UART_CH, NULL, NULL);
        }
        return true;
    }
    return false;
}

// --- Existing Scanner/Emulate Logic (Simplified for brevity) ---
static void autosec_scanner_widget_draw_callback(Canvas* canvas, void* context) {
    AutoSecApp* app = context;
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str_aligned(canvas, 64, 10, AlignCenter, AlignTop, "Sub-GHz Scanner");
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str_aligned(canvas, 64, 30, AlignCenter, AlignTop, app->is_scanning ? "SCANNING..." : "Ready");
}

static bool autosec_scanner_widget_input_callback(InputEvent* event, void* context) {
    AutoSecApp* app = context;
    if(event->type == InputTypeShort && event->key == InputKeyOk) {
        app->is_scanning = !app->is_scanning;
        return true;
    }
    return false;
}

void autosec_submenu_callback(void* context, uint32_t index) {
    AutoSecApp* app = context;
    if(index == AutoSecSubmenuIndexScan) {
        view_dispatcher_switch_to_view(app->view_dispatcher, AutoSecViewScanner);
    } else if(index == AutoSecSubmenuIndexEmulate) {
        view_dispatcher_switch_to_view(app->view_dispatcher, AutoSecViewEmulate);
    } else if(index == AutoSecSubmenuIndexCAN) {
        view_dispatcher_switch_to_view(app->view_dispatcher, AutoSecViewCAN);
    } else if(index == AutoSecSubmenuIndexAbout) {
        view_dispatcher_switch_to_view(app->view_dispatcher, AutoSecViewAbout);
    }
}

uint32_t autosec_back_event_callback(void* context) {
    AutoSecApp* app = context;
    app->is_scanning = false;
    app->is_emulating = false;
    app->is_can_active = false;
    return AutoSecViewSubmenu;
}

AutoSecApp* autosec_app_alloc() {
    AutoSecApp* app = malloc(sizeof(AutoSecApp));
    app->frequency = 433920000;
    app->is_scanning = false;
    app->is_emulating = false;
    app->is_can_active = false;
    app->last_captured_data = furi_string_alloc();
    app->can_log = furi_string_alloc();

    app->view_dispatcher = view_dispatcher_alloc();
    Gui* gui = furi_record_open(RECORD_GUI);
    view_dispatcher_attach_to_gui(app->view_dispatcher, gui, ViewDispatcherTypeFullscreen);
    view_dispatcher_set_navigation_event_callback(app->view_dispatcher, autosec_back_event_callback);

    app->submenu = submenu_alloc();
    submenu_set_header(app->submenu, "AutoSec x1000 + CAN");
    submenu_add_item(app->submenu, "Sub-GHz Scanner", AutoSecSubmenuIndexScan, autosec_submenu_callback, app);
    submenu_add_item(app->submenu, "Signal Emulation", AutoSecSubmenuIndexEmulate, autosec_submenu_callback, app);
    submenu_add_item(app->submenu, "CAN Bus (ESP32)", AutoSecSubmenuIndexCAN, autosec_submenu_callback, app);
    submenu_add_item(app->submenu, "Legal/About", AutoSecSubmenuIndexAbout, autosec_submenu_callback, app);
    view_dispatcher_add_view(app->view_dispatcher, AutoSecViewSubmenu, submenu_get_view(app->submenu));

    app->text_box = text_box_alloc();
    text_box_set_header(app->text_box, "Pentest Disclaimer");
    text_box_set_text(app->text_box, "Authorized research only.\nSub-GHz + CAN Bus Integration.\nESP32 required for CAN.");
    view_dispatcher_add_view(app->view_dispatcher, AutoSecViewAbout, text_box_get_view(app->text_box));

    app->scanner_widget = widget_alloc();
    widget_draw_callback_set(app->scanner_widget, autosec_scanner_widget_draw_callback, app);
    widget_input_callback_set(app->scanner_widget, autosec_scanner_widget_input_callback, app);
    view_dispatcher_add_view(app->view_dispatcher, AutoSecViewScanner, widget_get_view(app->scanner_widget));

    app->can_widget = widget_alloc();
    widget_draw_callback_set(app->can_widget, autosec_can_widget_draw_callback, app);
    widget_input_callback_set(app->can_widget, autosec_can_widget_input_callback, app);
    view_dispatcher_add_view(app->view_dispatcher, AutoSecViewCAN, widget_get_view(app->can_widget));

    view_dispatcher_switch_to_view(app->view_dispatcher, AutoSecViewSubmenu);
    return app;
}

void autosec_app_free(AutoSecApp* app) {
    furi_hal_uart_set_irq_cb(UART_CH, NULL, NULL);
    view_dispatcher_remove_view(app->view_dispatcher, AutoSecViewSubmenu);
    view_dispatcher_remove_view(app->view_dispatcher, AutoSecViewAbout);
    view_dispatcher_remove_view(app->view_dispatcher, AutoSecViewScanner);
    view_dispatcher_remove_view(app->view_dispatcher, AutoSecViewCAN);
    submenu_free(app->submenu);
    text_box_free(app->text_box);
    widget_free(app->scanner_widget);
    widget_free(app->can_widget);
    furi_string_free(app->last_captured_data);
    furi_string_free(app->can_log);
    view_dispatcher_free(app->view_dispatcher);
    furi_record_close(RECORD_GUI);
    free(app);
}

int32_t autosec_tool_app(void* p) {
    UNUSED(p);
    AutoSecApp* app = autosec_app_alloc();
    view_dispatcher_run(app->view_dispatcher);
    autosec_app_free(app);
    return 0;
}
