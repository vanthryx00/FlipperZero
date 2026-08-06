# Flipper Zero FAP Development Reference

## Core Concepts

### FAP (Flipper Application Package)
- External applications that run on Flipper Zero
- Compiled as `.fap` files
- Loaded from SD card or built into firmware
- Isolated from core OS for safety

### Application Structure

Every FAP requires:
1. **C Source File** (`app_name.c`) - Application logic
2. **Manifest File** (`application.fam`) - Application metadata

### Memory Management

- Stack size: Typically 2 KB for most applications
- Heap allocation: Use `malloc()` and `free()`
- Always deallocate resources in cleanup functions
- Use Flipper's memory utilities: `furi_alloc()`, `furi_free()`

## Key Flipper OS Libraries

### Core Libraries
- `furi.h` - Kernel and threading
- `furi_hal.h` - Hardware abstraction layer
- `furi_record.h` - System records (GUI, storage, etc.)

### GUI Framework
- `gui/gui.h` - Main GUI interface
- `gui/view_dispatcher.h` - View management
- `gui/elements.h` - UI elements (text, rectangles, etc.)
- `gui/modules/submenu.h` - Menu UI
- `gui/modules/widget.h` - Generic widget
- `gui/modules/text_box.h` - Text display
- `gui/modules/text_input.h` - Text input

### Hardware Access
- `furi_hal_gpio.h` - GPIO control
- `furi_hal_uart.h` - Serial communication
- `furi_hal_spi.h` - SPI interface
- `furi_hal_power.h` - Power management

### Storage
- `storage/storage.h` - File system access
- `storage/file.h` - File operations

### Notifications
- `notification/notification.h` - Notification service
- `notification/notification_messages.h` - Predefined notifications

## Application Lifecycle

1. **Initialization** (`*_app_alloc()`)
   - Allocate app structure
   - Initialize GUI components
   - Set up view dispatcher
   - Register views

2. **Main Loop** (`*_app()`)
   - Attach GUI to dispatcher
   - Switch to initial view
   - Run view dispatcher (blocks until exit)

3. **Cleanup** (`*_app_free()`)
   - Remove all views
   - Free GUI components
   - Release resources
   - Free app structure

## View Dispatcher Pattern

```c
// Create dispatcher
ViewDispatcher* view_dispatcher = view_dispatcher_alloc();

// Add views
view_dispatcher_add_view(dispatcher, VIEW_ID, view);

// Switch to view
view_dispatcher_switch_to_view(dispatcher, VIEW_ID);

// Run (blocks)
view_dispatcher_run(dispatcher);

// Cleanup
view_dispatcher_remove_view(dispatcher, VIEW_ID);
view_dispatcher_free(dispatcher);
```

## Common Patterns

### Logging to SD Card
```c
#define LOG_FILE_PATH EXT_PATH("app_name.log")

// Write to log
File* file = storage_file_alloc(storage);
storage_file_open(file, LOG_FILE_PATH, FSAM_WRITE, FSOM_OPEN_APPEND);
storage_file_write(file, (uint8_t*)message, strlen(message));
storage_file_close(file);
storage_file_free(file);
```

### Hardware Communication
```c
// GPIO
furi_hal_gpio_init(gpio_pin, GpioModeOutput, GpioPullNo, GpioSpeedVeryHigh);
furi_hal_gpio_write(gpio_pin, true);

// UART
FuriHalUartId uart_id = FuriHalUartIdUSART1;
furi_hal_uart_set_br(uart_id, 115200);
furi_hal_uart_tx(uart_id, data, length);
```

### UI Elements
```c
// Text
canvas_draw_str(canvas, x, y, "Hello");

// Rectangle
canvas_draw_box(canvas, x, y, width, height);

// Widget
widget_add_string_element(widget, x, y, align_h, align_v, font, text);
```

## Manifest File Format

```python
App(
    appid="unique_app_id",
    name="Display Name",
    apptype=FlipperAppType.EXTERNAL,
    entry_point="app_entry_function",
    stack_size=2 * 1024,
    fap_category="Tools",
    fap_description="Brief description",
    fap_author="Author Name",
    fap_weburl="https://github.com/author/app",
    fap_version="1.0.0",
    fap_icon="icon.png",
)
```

## Build Commands

```bash
# Build single FAP
./fbt fap_app_name

# Build multiple FAPs
./fbt fap_app1 fap_app2 fap_app3

# Flash to device
./fbt flash_usb_fap build/f7/apps/external/app_name.fap

# Deploy to SD card
cp build/f7/apps/external/*.fap /path/to/flipper/sd/apps/external/
```

## Best Practices

1. **Memory Safety**
   - Always check allocation success
   - Free in reverse order of allocation
   - Use static allocation when possible

2. **Error Handling**
   - Check return values
   - Handle edge cases
   - Provide user feedback

3. **Performance**
   - Minimize main loop work
   - Use callbacks for events
   - Avoid blocking operations

4. **Security**
   - Validate input data
   - Avoid buffer overflows
   - Use safe string functions

5. **User Experience**
   - Clear navigation
   - Responsive UI
   - Helpful error messages
   - About/info screens

## Testing

1. **Build locally** - Ensure compilation succeeds
2. **Run on device** - Test all features
3. **Check logs** - Review SD card logs for errors
4. **Memory test** - Verify no leaks with tools
5. **Edge cases** - Test boundary conditions

## Debugging

- Use `furi_log_*()` functions for logging
- Check `/ext/logs/` on SD card
- Use Flipper's built-in tools
- Monitor power consumption
- Test with various hardware configurations
