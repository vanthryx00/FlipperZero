"""Create the standard indexes (+ Atlas Search/Vector Search indexes).

Run against Atlas (MONGODB_URI set) or against the local FileStore (which
needs no indexes and reports as such).
"""
from __future__ import annotations

import sys

from .store import StoreFeatureError, get_store


def main() -> int:
    store = get_store()
    print(f"backend : {store.backend}")

    try:
        store.ping()
        print("ping    : ok")
    except Exception as exc:  # noqa: BLE001
        print(f"ping    : FAILED -- {exc}")
        return 1

    try:
        created = store.ensure_indexes()
        print(f"indexes : ensured {len(created)} standard index(es)")
        for name in created:
            print(f"          - {name}")
    except Exception as exc:  # noqa: BLE001
        print(f"indexes : FAILED -- {exc}")
        return 1

    if store.backend == "atlas":
        try:
            created = store.create_search_indexes()
            print(f"search  : created Atlas Search indexes: {created}")
            if not created:
                print("          (already present)")
            print("          NOTE: $text keyword search works on the free M0 tier;")
            print("          $vectorSearch needs an M10+ dedicated tier.")
        except StoreFeatureError as exc:
            print(f"search  : SKIPPED -- {exc}")
    else:
        print("search  : local FileStore needs no Atlas search indexes.")

    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
