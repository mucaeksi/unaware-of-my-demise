# UOMD `.asmdef` Dependency Graph & IL2CPP Preservation

## Strict Assembly Dependency DAG

```
Uomd.Contracts (zero internal dependencies)
   ▲
Uomd.Core (depends on Uomd.Contracts)
   ▲
   ├── Uomd.Combat (depends on Uomd.Contracts, Uomd.Core; NO MonoBehaviour/Scene refs)
   ├── Uomd.Platform (depends on Uomd.Contracts, Uomd.Core)
   └── Uomd.UI (depends on Uomd.Contracts, Uomd.Core, Uomd.Platform)
          ▲
          ├── Uomd.Battle (depends on Uomd.Contracts, Uomd.Core, Uomd.Combat, Uomd.Platform, Uomd.UI)
          └── Uomd.Narrative (depends on Uomd.Contracts, Uomd.Core, Uomd.Platform, Uomd.UI)
```

## Required `link.xml` for IL2CPP (`apps/unity/Assets/_UOMD/link.xml`)

```xml
<linker>
  <assembly fullname="Uomd.Contracts" preserve="all" />
  <assembly fullname="Uomd.Core" preserve="all" />
  <assembly fullname="Uomd.Combat" preserve="all" />
</linker>
```
