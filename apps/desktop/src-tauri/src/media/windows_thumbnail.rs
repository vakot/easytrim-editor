use std::{
    ffi::c_void,
    fs::File,
    io::Write,
    os::windows::ffi::OsStrExt,
    path::Path,
    ptr::{null, null_mut},
};

use windows_sys::{
    Win32::{
        Foundation::SIZE,
        Graphics::Gdi::{
            BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, CreateCompatibleDC, DIB_RGB_COLORS,
            DeleteDC, DeleteObject, GetDIBits, GetObjectW, HBITMAP,
        },
        System::Com::{COINIT_MULTITHREADED, CoInitializeEx, CoUninitialize},
        UI::Shell::SHCreateItemFromParsingName,
    },
    core::GUID,
};

use crate::state::PreviewArtifact;

const IMAGE_FACTORY_ID: GUID = GUID::from_u128(0xBCC18B79_BA16_442F_80C4_8A59C30C463B);
const THUMBNAIL_CACHE_ONLY_FLAGS: u32 = 0x10 | 0x08;
const SHELL_THUMBNAIL_WIDTH: i32 = 480;
const SHELL_THUMBNAIL_HEIGHT: i32 = 270;

#[repr(C)]
struct ImageFactory {
    vtable: *const ImageFactoryVtable,
}

#[repr(C)]
struct ImageFactoryVtable {
    query_interface: unsafe extern "system" fn(
        this: *mut ImageFactory,
        iid: *const GUID,
        interface: *mut *mut c_void,
    ) -> i32,
    add_ref: unsafe extern "system" fn(this: *mut ImageFactory) -> u32,
    release: unsafe extern "system" fn(this: *mut ImageFactory) -> u32,
    get_image: unsafe extern "system" fn(
        this: *mut ImageFactory,
        size: *const SIZE,
        flags: u32,
        bitmap: *mut HBITMAP,
    ) -> i32,
}

pub(super) fn cached_thumbnail(source_path: &Path) -> Option<PreviewArtifact> {
    // Cache-only plus thumbnail-only prevents shell extraction and generic file icons.
    let initialized = unsafe { CoInitializeEx(null(), COINIT_MULTITHREADED as u32) } >= 0;
    if !initialized {
        return None;
    }

    let thumbnail = get_cached_thumbnail(source_path);
    unsafe { CoUninitialize() };
    thumbnail
}

fn get_cached_thumbnail(source_path: &Path) -> Option<PreviewArtifact> {
    let source_path = source_path
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let mut factory_pointer = null_mut::<c_void>();
    let result = unsafe {
        SHCreateItemFromParsingName(
            source_path.as_ptr(),
            null_mut(),
            &IMAGE_FACTORY_ID,
            &mut factory_pointer,
        )
    };
    let factory = factory_pointer.cast::<ImageFactory>();
    if result < 0 || factory.is_null() {
        return None;
    }

    let requested_size = SIZE {
        cx: SHELL_THUMBNAIL_WIDTH,
        cy: SHELL_THUMBNAIL_HEIGHT,
    };
    let mut bitmap = null_mut();
    let result = unsafe {
        ((*(*factory).vtable).get_image)(
            factory,
            &requested_size,
            THUMBNAIL_CACHE_ONLY_FLAGS,
            &mut bitmap,
        )
    };
    unsafe { ((*(*factory).vtable).release)(factory) };
    if result < 0 || bitmap.is_null() {
        return None;
    }

    let artifact = super::thumbnail::create_artifact("bmp").ok();
    let saved = artifact
        .as_ref()
        .is_some_and(|artifact| save_bitmap(bitmap, artifact.path()).is_ok());
    unsafe { DeleteObject(bitmap.cast()) };

    saved.then_some(artifact).flatten()
}

fn save_bitmap(bitmap: HBITMAP, path: &Path) -> std::io::Result<()> {
    let mut dimensions = BITMAP::default();
    let bitmap_info_size = std::mem::size_of::<BITMAP>() as i32;
    if unsafe {
        GetObjectW(
            bitmap,
            bitmap_info_size,
            (&mut dimensions as *mut BITMAP).cast(),
        )
    } != bitmap_info_size
        || dimensions.bmWidth <= 0
        || dimensions.bmHeight <= 0
    {
        return Err(std::io::Error::other(
            "The shell thumbnail bitmap is invalid.",
        ));
    }

    let width = dimensions.bmWidth as u32;
    let height = dimensions.bmHeight as u32;
    let image_size = width
        .checked_mul(height)
        .and_then(|pixels| pixels.checked_mul(4))
        .filter(|size| *size <= 64 * 1024 * 1024)
        .ok_or_else(|| std::io::Error::other("The shell thumbnail bitmap is too large."))?;
    let mut info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: dimensions.bmWidth,
            biHeight: -dimensions.bmHeight,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            biSizeImage: image_size,
            ..BITMAPINFOHEADER::default()
        },
        ..BITMAPINFO::default()
    };
    let mut pixels = vec![0; image_size as usize];
    let dc = unsafe { CreateCompatibleDC(null_mut()) };
    if dc.is_null() {
        return Err(std::io::Error::last_os_error());
    }
    let scan_lines = unsafe {
        GetDIBits(
            dc,
            bitmap,
            0,
            height,
            pixels.as_mut_ptr().cast(),
            &mut info,
            DIB_RGB_COLORS,
        )
    };
    unsafe { DeleteDC(dc) };
    if scan_lines != height as i32 {
        return Err(std::io::Error::last_os_error());
    }

    let file_size = 54_u32 + image_size;
    let mut file = File::create(path)?;
    file.write_all(b"BM")?;
    file.write_all(&file_size.to_le_bytes())?;
    file.write_all(&[0; 4])?;
    file.write_all(&54_u32.to_le_bytes())?;
    file.write_all(&40_u32.to_le_bytes())?;
    file.write_all(&(width as i32).to_le_bytes())?;
    file.write_all(&(-(height as i32)).to_le_bytes())?;
    file.write_all(&1_u16.to_le_bytes())?;
    file.write_all(&32_u16.to_le_bytes())?;
    file.write_all(&BI_RGB.to_le_bytes())?;
    file.write_all(&image_size.to_le_bytes())?;
    file.write_all(&[0; 16])?;
    file.write_all(&pixels)
}
