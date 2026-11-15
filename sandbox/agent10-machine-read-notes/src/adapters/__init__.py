"""Read-only adapters exposing consistent asset identity without inventing REPD references."""
from .records import AssetAdapter, RepdAdapter, DataCentreAdapter, attach_sidecar, asset_key_string

__all__ = ('AssetAdapter', 'RepdAdapter', 'DataCentreAdapter', 'attach_sidecar', 'asset_key_string')
