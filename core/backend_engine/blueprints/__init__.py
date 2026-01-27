"""
Core Blueprints Registry

This module provides a registry of all core blueprints that can be
automatically registered by the application factory.
"""

from typing import List, Tuple

# Core blueprints registry: (module_path, url_prefix)
CORE_BLUEPRINTS: List[Tuple[str, str]] = [
    ('core.backend_engine.blueprints.main', ''),
    ('core.backend_engine.blueprints.auth', '/auth'),
    ('core.backend_engine.blueprints.api', '/api/v1'),
    ('core.backend_engine.blueprints.admin', '/admin'),
    ('core.backend_engine.blueprints.errors', ''),
]


def get_core_blueprints():
    """
    Get all core blueprint configurations.

    Returns:
        List of tuples: (blueprint_module_path, url_prefix)
    """
    return CORE_BLUEPRINTS.copy()
