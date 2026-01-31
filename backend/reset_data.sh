#!/bin/bash

# Script to reset all data except admin users
# Usage: ./reset_data.sh

echo "=========================================="
echo "  GAPAL - Data Reset Script"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will delete ALL data except admin users!"
echo ""
echo "The following data will be deleted:"
echo "  - All orders and order items"
echo "  - All sales and sale items"
echo "  - All stock movements"
echo "  - All products"
echo "  - All categories"
echo "  - All notifications"
echo "  - All audit logs"
echo "  - All non-admin users"
echo ""
echo "Admin users (is_superuser=True) will be preserved."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Starting data reset..."
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Run the Django management command
python manage.py reset_data --confirm

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  ✓ Data reset completed successfully!"
    echo "=========================================="
else
    echo ""
    echo "=========================================="
    echo "  ✗ Error during data reset"
    echo "=========================================="
    exit 1
fi
