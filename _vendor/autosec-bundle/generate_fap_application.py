#!/usr/bin/env python3
"""
Generate Flipper Zero FAP applications with proper structure and manifests.
Usage: python generate_fap_application.py <app_name> <app_type> <description>
"""

import os
import sys
from pathlib import Path

def generate_fap_application(app_name, app_type, description, author="Koko"):
    """Generate a complete Flipper Zero FAP application structure."""
    
    # Create application directory
    app_dir = Path(f"flipper-zero/{app_name}")
    app_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate C source file
    c_template = f'''#include <furi.h>
#include <furi_hal.h>
#include <gui/gui.h>
#include <gui/elements.h>
#include <gui/modules/submenu.h>
#include <gui/modules/widget.h>
#include <gui/view_dispatcher.h>
#include <storage/storage.h>

#define LOG_FILE_PATH EXT_PATH("{app_name}.log")

typedef enum {{
    {app_name.upper()}_VIEW_SUBMENU,
    {app_name.upper()}_VIEW_MAIN,
    {app_name.upper()}_VIEW_ABOUT,
}} {app_name.capitalize()}View;

typedef struct {{
    Gui* gui;
    ViewDispatcher* view_dispatcher;
    Submenu* submenu;
    Widget* widget;
    Storage* storage;
}} {app_name.capitalize()}App;

static void {app_name}_submenu_callback(void* context, uint32_t index) {{
    // Handle submenu selection
}}

static void {app_name}_about_view(Widget* widget) {{
    widget_add_string_element(widget, 0, 0, AlignLeft, AlignTop, FontPrimary, "{app_name.upper()}");
    widget_add_string_element(widget, 0, 15, AlignLeft, AlignTop, FontSecondary, "v1.0.0");
    widget_add_string_element(widget, 0, 30, AlignLeft, AlignTop, FontSecondary, "Author: {author}");
    widget_add_string_element(widget, 0, 45, AlignLeft, AlignTop, FontSecondary, "{description}");
}}

static {app_name.capitalize()}App* {app_name}_app_alloc(void) {{
    {app_name.capitalize()}App* app = malloc(sizeof({app_name.capitalize()}App));
    
    app->gui = furi_record_open(RECORD_GUI);
    app->view_dispatcher = view_dispatcher_alloc();
    app->submenu = submenu_alloc();
    app->widget = widget_alloc();
    app->storage = furi_record_open(RECORD_STORAGE);
    
    view_dispatcher_enable_queue(app->view_dispatcher);
    view_dispatcher_add_view(app->view_dispatcher, {app_name.upper()}_VIEW_SUBMENU, submenu_get_view(app->submenu));
    view_dispatcher_add_view(app->view_dispatcher, {app_name.upper()}_VIEW_MAIN, widget_get_view(app->widget));
    
    submenu_add_item(app->submenu, "Main", {app_name.upper()}_VIEW_MAIN, {app_name}_submenu_callback, app);
    submenu_add_item(app->submenu, "About", {app_name.upper()}_VIEW_ABOUT, {app_name}_submenu_callback, app);
    
    {app_name}_about_view(app->widget);
    
    return app;
}}

static void {app_name}_app_free({app_name.capitalize()}App* app) {{
    view_dispatcher_remove_view(app->view_dispatcher, {app_name.upper()}_VIEW_SUBMENU);
    view_dispatcher_remove_view(app->view_dispatcher, {app_name.upper()}_VIEW_MAIN);
    view_dispatcher_free(app->view_dispatcher);
    submenu_free(app->submenu);
    widget_free(app->widget);
    furi_record_close(RECORD_GUI);
    furi_record_close(RECORD_STORAGE);
    free(app);
}}

int32_t {app_name}_app(void* p) {{
    UNUSED(p);
    {app_name.capitalize()}App* app = {app_name}_app_alloc();
    
    view_dispatcher_attach_to_gui(app->view_dispatcher, app->gui, ViewDispatcherTypeFullscreen);
    view_dispatcher_switch_to_view(app->view_dispatcher, {app_name.upper()}_VIEW_SUBMENU);
    
    furi_hal_power_insomnia_enter();
    
    furi_thread_set_name(furi_thread_get_current(), "{app_name}");
    
    view_dispatcher_run(app->view_dispatcher);
    
    furi_hal_power_insomnia_exit();
    {app_name}_app_free(app);
    
    return 0;
}}
'''
    
    # Generate manifest file
    manifest_template = f'''App(
    appid="{app_name}",
    name="{app_name.replace('_', ' ').title()}",
    apptype=FlipperAppType.EXTERNAL,
    entry_point="{app_name}_app",
    stack_size=2 * 1024,
    fap_category="Tools",
    fap_description="{description}",
    fap_author="{author}",
    fap_weburl="https://github.com/koko/{app_name}",
    fap_version="1.0.0",
    fap_icon="icon.png",
)
'''
    
    # Write files
    c_file = app_dir / f"{app_name}.c"
    manifest_file = app_dir / "application.fam"
    
    with open(c_file, 'w') as f:
        f.write(c_template)
    
    with open(manifest_file, 'w') as f:
        f.write(manifest_template)
    
    print(f"✓ Generated {app_name} FAP application")
    print(f"  - Source: {c_file}")
    print(f"  - Manifest: {manifest_file}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python generate_fap_application.py <app_name> <app_type> <description>")
        sys.exit(1)
    
    app_name = sys.argv[1]
    app_type = sys.argv[2]
    description = sys.argv[3]
    
    generate_fap_application(app_name, app_type, description)
