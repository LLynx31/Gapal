"""
Django settings module.
Loads development settings by default.
Set DJANGO_SETTINGS_MODULE=config.settings.production for production.
"""

import os

environment = os.environ.get('DJANGO_ENV', 'development')

if environment == 'production':
    from .production import *
else:
    from .development import *
