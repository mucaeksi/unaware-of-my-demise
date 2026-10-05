class_name UiTheme
extends RefCounted
## Stable screen API; shared art system v02 replaces the purple placeholder palette.
const GothicTheme = preload("res://theme/gothic_system_v02.gd")
const BACKGROUND: Color = GothicTheme.INK
const PANEL: Color = GothicTheme.PANEL
const PANEL_RAISED: Color = GothicTheme.RAISED
const PANEL_HOVER: Color = GothicTheme.HOVER
const PANEL_SELECTED: Color = GothicTheme.WINE_PRESSED
const ACCENT: Color = GothicTheme.GOLD
const TEXT: Color = GothicTheme.BONE
const TEXT_DIM: Color = GothicTheme.MUTED
const DANGER: Color = GothicTheme.DANGER
const HEAL: Color = GothicTheme.TEAL
const PLAYER_TINT: Color = Color("#718b9c")
const ENEMY_TINT: Color = Color("#9a5963")
const FONT_BODY: int = GothicTheme.BODY
const FONT_SMALL: int = GothicTheme.SMALL
const FONT_TITLE: int = 60
const CORNER: int = 8
## 48 dp at 360 dp width on the 1080-wide canvas. Android density acceptance pending.
const TOUCH_HEIGHT: int = GothicTheme.TOUCH_HEIGHT
const TITLE: String = "TitleLabel"
const DIM: String = "DimLabel"
const SMALL: String = "SmallLabel"
const DANGER_LABEL: String = "DangerLabel"
const PLACEHOLDER_TAG: String = "PlaceholderTag"
const BAR_PLAYER: String = "HpBarPlayer"
const BAR_ENEMY: String = "HpBarEnemy"
const PRIMARY: String = GothicTheme.PRIMARY
const SECONDARY: String = GothicTheme.SECONDARY
const DESTRUCTIVE: String = GothicTheme.DESTRUCTIVE
const NAVIGATION: String = GothicTheme.NAVIGATION
const ICON: String = GothicTheme.ICON
const MODAL_ACTION: String = GothicTheme.MODAL_ACTION
const FRAME: String = GothicTheme.FRAME


static func box(color: Color, corner: int = CORNER, border: Color = Color.TRANSPARENT, border_width: int = 0, margin_x: int = 28, margin_y: int = 16) -> StyleBoxFlat:
	return GothicTheme.box(color, border, border_width, corner, margin_x, margin_y)


static func create() -> Theme:
	return GothicTheme.create()
