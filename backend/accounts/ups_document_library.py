from pathlib import Path

from django.conf import settings


def ups_library_pdfs():
    folder = Path(settings.BASE_DIR) / "data" / "ups document"
    files = sorted(folder.glob("*"), key=lambda path: path.name.casefold())
    return {
        f"library:{path.name}": path
        for path in files
        if path.suffix.lower() == ".pdf" and path.is_file() and not path.is_symlink()
    }
