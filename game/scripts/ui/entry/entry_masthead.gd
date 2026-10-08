extends RefCounted
## Account/patch wordmark geometry. Title has a lower art-specific position;
## prologue uses the same asset as a small translucent corner watermark.
const HEIGHT: int = 300
const TOP_SPACE: int = 216
const SEPARATION: int = 12
const WORDMARK: Texture2D = preload("res://assets/ui/narrative/v002/approved_wordmark.png")

static func logo() -> TextureRect:
	var image: TextureRect = TextureRect.new()
	image.texture = WORDMARK
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	image.custom_minimum_size.y = HEIGHT
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return image
