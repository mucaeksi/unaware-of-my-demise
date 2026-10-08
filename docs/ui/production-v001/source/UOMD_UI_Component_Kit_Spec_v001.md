# Unaware of My Demise — UI Component Kit v001

**Status:** Production candidate
**Engine:** Godot 4.7.2 Standard
**Base canvas:** 1080×1920 portrait
**Rule:** no runtime text or icon labels are baked into reusable textures.

## Runtime assets

| Asset | Type | Size | 9-slice (L,T,R,B) | Variant | State |
|---|---|---:|---|---|---|
| `UOMD_UI_Panel_Standard_9Slice_v001.png` | panel | 480×320 | 72, 72, 72, 72 | standard | — |
| `UOMD_UI_Panel_Hero_9Slice_v001.png` | panel | 480×320 | 72, 72, 72, 72 | hero | — |
| `UOMD_UI_Panel_Modal_9Slice_v001.png` | panel | 480×320 | 72, 72, 72, 72 | modal | — |
| `UOMD_UI_Panel_Sheet_9Slice_v001.png` | panel | 480×320 | 72, 72, 72, 72 | sheet | — |
| `UOMD_UI_Button_Primary_Default_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | primary | default |
| `UOMD_UI_Button_Primary_Pressed_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | primary | pressed |
| `UOMD_UI_Button_Primary_Disabled_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | primary | disabled |
| `UOMD_UI_Button_Primary_Success_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | primary | success |
| `UOMD_UI_Button_Primary_Error_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | primary | error |
| `UOMD_UI_Button_Secondary_Default_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | secondary | default |
| `UOMD_UI_Button_Secondary_Pressed_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | secondary | pressed |
| `UOMD_UI_Button_Secondary_Disabled_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | secondary | disabled |
| `UOMD_UI_Button_Destructive_Default_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | destructive | default |
| `UOMD_UI_Button_Destructive_Pressed_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | destructive | pressed |
| `UOMD_UI_Button_Destructive_Disabled_9Slice_v001.png` | button | 720×168 | 88, 56, 88, 56 | destructive | disabled |
| `UOMD_UI_Nav_Backplate_9Slice_v001.png` | navigation | 1080×210 | 72, 48, 72, 48 | — | — |
| `UOMD_UI_Card_Standard_9Slice_v001.png` | card | 420×600 | 64, 96, 64, 96 | standard | default |
| `UOMD_UI_Badge_Standard_9Slice_v001.png` | badge | 240×96 | 32, 28, 32, 28 | standard | default |

## Godot integration

- Use `NinePatchRect` or `StyleBoxTexture` for scalable panel/button/card surfaces.
- Button text and icons remain separate runtime Controls.
- `Nav_Backplate` contains no baked tab labels or icons.
- Minimum touch target on the 1080-wide design canvas is approximately 144 px (≈48 dp).
- Safe-area offsets are device/runtime driven.
- Verify the initial 9-slice margins in Godot before propagating the kit across all screens.
- Primary, destructive, success, error and disabled states are structurally distinct; color is never the sole carrier.

## Next application order

`Entry → Hub → Journey → Formation → Battle → Results`