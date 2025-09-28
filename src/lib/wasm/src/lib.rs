use wasm_bindgen::prelude::*;
use image::{ImageBuffer, Rgba, ImageFormat};
use base64::{Engine as _, engine::general_purpose};

#[wasm_bindgen]
pub fn composite_images(base_image_data: &[u8], overlay_image_data: &[u8]) -> Result<String, JsValue> {
    // Decode base image
    let base_img = image::load_from_memory(base_image_data)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode base image: {}", e)))?;
    
    // Decode overlay image
    let overlay_img = image::load_from_memory(overlay_image_data)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode overlay image: {}", e)))?;
    
    // Create a new image buffer for the result
    let mut result_img = base_img.to_rgba8();
    
    // Composite the images (overlay on top of base)
    for (x, y, overlay_pixel) in overlay_img.to_rgba8().enumerate_pixels() {
        if x < result_img.width() && y < result_img.height() {
            let base_pixel = result_img.get_pixel(x, y);
            let composited_pixel = blend_pixels(*base_pixel, *overlay_pixel);
            result_img.put_pixel(x, y, composited_pixel);
        }
    }
    
    // Encode result to PNG
    let mut buffer = Vec::new();
    let result_buffer = image::ImageBuffer::from(result_img);
    result_buffer.write_to(&mut std::io::Cursor::new(&mut buffer), ImageFormat::Png)
        .map_err(|e| JsValue::from_str(&format!("Failed to encode result image: {}", e)))?;
    
    // Convert to base64 for transfer
    let base64_data = general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:image/png;base64,{}", base64_data))
}

#[wasm_bindgen]
pub fn composite_multiple_layers(base_image_data: &[u8], layers_data: js_sys::Array) -> Result<String, JsValue> {
    // Decode base image
    let mut result_img = image::load_from_memory(base_image_data)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode base image: {}", e)))?
        .to_rgba8();
    
    // Process each overlay layer
    for layer_value in layers_data.iter() {
        let layer_base64 = layer_value.as_string()
            .ok_or_else(|| JsValue::from_str("Layer data must be a string"))?;
        
        // Remove data URL prefix if present
        let base64_content = if layer_base64.starts_with("data:image") {
            layer_base64.split(",").nth(1)
                .ok_or_else(|| JsValue::from_str("Invalid data URL format"))?
        } else {
            &layer_base64
        };
        
        // Decode base64 to bytes
        let overlay_bytes = general_purpose::STANDARD
            .decode(base64_content)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode base64: {}", e)))?;
        
        // Load overlay image
        let overlay_img = image::load_from_memory(&overlay_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode overlay image: {}", e)))?
            .to_rgba8();
        
        // Composite the images
        for (x, y, overlay_pixel) in overlay_img.enumerate_pixels() {
            if x < result_img.width() && y < result_img.height() {
                let base_pixel = result_img.get_pixel(x, y);
                let composited_pixel = blend_pixels(*base_pixel, *overlay_pixel);
                result_img.put_pixel(x, y, composited_pixel);
            }
        }
    }
    
    // Encode result to PNG
    let mut buffer = Vec::new();
    let result_buffer = image::ImageBuffer::from(result_img);
    result_buffer.write_to(&mut std::io::Cursor::new(&mut buffer), ImageFormat::Png)
        .map_err(|e| JsValue::from_str(&format!("Failed to encode result image: {}", e)))?;
    
    // Convert to base64 for transfer
    let base64_data = general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:image/png;base64,{}", base64_data))
}

#[wasm_bindgen]
pub fn generate_preview(base_image_data: &[u8], overlay_image_data: &[u8], width: u32, height: u32) -> Result<String, JsValue> {
    // Decode base image
    let mut base_img = image::load_from_memory(base_image_data)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode base image: {}", e)))?
        .to_rgba8();
    
    // Resize base image to preview size
    if base_img.width() != width || base_img.height() != height {
        base_img = image::imageops::resize(&base_img, width, height, image::imageops::Lanczos3);
    }
    
    // Decode overlay image
    let overlay_img = image::load_from_memory(overlay_image_data)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode overlay image: {}", e)))?
        .to_rgba8();
    
    // Resize overlay to match preview size
    let resized_overlay = if overlay_img.width() != width || overlay_img.height() != height {
        image::imageops::resize(&overlay_img, width, height, image::imageops::Lanczos3)
    } else {
        overlay_img
    };
    
    // Composite the images
    for (x, y, overlay_pixel) in resized_overlay.enumerate_pixels() {
        if x < base_img.width() && y < base_img.height() {
            let base_pixel = base_img.get_pixel(x, y);
            let composited_pixel = blend_pixels(*base_pixel, *overlay_pixel);
            base_img.put_pixel(x, y, composited_pixel);
        }
    }
    
    // Encode result to PNG
    let mut buffer = Vec::new();
    let result_buffer = image::ImageBuffer::from(base_img);
    result_buffer.write_to(&mut std::io::Cursor::new(&mut buffer), ImageFormat::Png)
        .map_err(|e| JsValue::from_str(&format!("Failed to encode result image: {}", e)))?;
    
    // Convert to base64 for transfer
    let base64_data = general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:image/png;base64,{}", base64_data))
}

// Helper function to blend pixels with alpha
fn blend_pixels(base: Rgba<u8>, overlay: Rgba<u8>) -> Rgba<u8> {
    let base_alpha = base[3] as f32 / 255.0;
    let overlay_alpha = overlay[3] as f32 / 255.0;
    let result_alpha = overlay_alpha + base_alpha * (1.0 - overlay_alpha);
    
    if result_alpha == 0.0 {
        return Rgba([0, 0, 0, 0]);
    }
    
    let r = ((overlay[0] as f32 * overlay_alpha + base[0] as f32 * base_alpha * (1.0 - overlay_alpha)) / result_alpha) as u8;
    let g = ((overlay[1] as f32 * overlay_alpha + base[1] as f32 * base_alpha * (1.0 - overlay_alpha)) / result_alpha) as u8;
    let b = ((overlay[2] as f32 * overlay_alpha + base[2] as f32 * base_alpha * (1.0 - overlay_alpha)) / result_alpha) as u8;
    let a = (result_alpha * 255.0) as u8;
    
    Rgba([r, g, b, a])
}

// Additional helper functions for WASM integration
#[wasm_bindgen]
pub fn init_console_panic_hook() {
    console_error_panic_hook::set_once();
}