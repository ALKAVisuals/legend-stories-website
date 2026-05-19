#!/bin/bash
# Legend Stories — Site Backup & Restore Script
# Gebruik: ./backup.sh [create|restore|list]

ACTION=${1:-list}
SITE_DIR="/home/karam/legend-murals"
BACKUP_DIR="$SITE_DIR/backups/versions"

case $ACTION in
  create)
    VERSION="v$(date +%Y%m%d-%H%M%S)"
    echo "Creating backup: $VERSION"
    mkdir -p "$BACKUP_DIR/$VERSION"
    cp "$SITE_DIR/index.html" "$BACKUP_DIR/$VERSION/"
    cp "$SITE_DIR/shop.html" "$BACKUP_DIR/$VERSION/"
    cp "$SITE_DIR/portfolio.html" "$BACKUP_DIR/$VERSION/"
    cp "$SITE_DIR/about.html" "$BACKUP_DIR/$VERSION/"
    cp -r "$SITE_DIR/js" "$BACKUP_DIR/$VERSION/"
    cp -r "$SITE_DIR/css" "$BACKUP_DIR/$VERSION/" 2>/dev/null
    echo "$VERSION" > "$BACKUP_DIR/LATEST"
    echo "Backup created: $VERSION"
    ls -la "$BACKUP_DIR/$VERSION/"
    ;;
  
  restore)
    if [ -z "$2" ]; then
      echo "Available versions:"
      ls -1 "$BACKUP_DIR" | grep -v LATEST | sort
      echo ""
      echo "Usage: ./backup.sh restore <version>"
      echo "Example: ./backup.sh restore v20260519-151303"
      exit 1
    fi
    VERSION="$2"
    if [ ! -d "$BACKUP_DIR/$VERSION" ]; then
      echo "Version $VERSION not found!"
      exit 1
    fi
    echo "Restoring from: $VERSION"
    cp "$BACKUP_DIR/$VERSION/index.html" "$SITE_DIR/"
    cp "$BACKUP_DIR/$VERSION/shop.html" "$SITE_DIR/"
    cp "$BACKUP_DIR/$VERSION/portfolio.html" "$SITE_DIR/"
    cp "$BACKUP_DIR/$VERSION/about.html" "$SITE_DIR/"
    cp -r "$BACKUP_DIR/$VERSION/js" "$SITE_DIR/"
    echo "Restored to $VERSION"
    ;;
  
  list)
    echo "Available backups:"
    echo "─────────────────"
    ls -1 "$BACKUP_DIR" | grep -v LATEST | sort | while read v; do
      SIZE=$(du -sh "$BACKUP_DIR/$v" | cut -f1)
      echo "  $v  ($SIZE)"
    done
    echo ""
    echo "Latest: $(cat $BACKUP_DIR/LATEST 2>/dev/null || echo 'none')"
    ;;
  
  *)
    echo "Usage: ./backup.sh [create|restore|list]"
    ;;
esac
