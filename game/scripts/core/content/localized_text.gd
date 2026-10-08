class_name LocalizedText
extends RefCounted
## Picks the player's language from a content record (INF-025). Content stores text per language as "<field>_<locale>"
## ("text_en", "title_en", ...; `content_language` "en" is the authored one). A screen asks for the field, never for
## "_en": a second language is a content addition ("text_tr") and needs no code change.
##
## Usage:
##   LocalizedText.pick(line, "text")                 # the current locale's text, else English, else ""
##   LocalizedText.pick(scene, "title", "tr")
##
## The locale is TranslationServer's (the device language unless the player chose one); only its language part is used
## ("tr_TR" -> "tr"). Glyphs the UI font lacks (Japanese, ...) rely on the system font fallback (FontFile
## allow_system_fallback, on by default); bundling a CJK font is a separate content decision.

const SOURCE_LOCALE: String = "en"


static func pick(record: Dictionary, field: String, locale: String = "") -> String:
	var language: String = language_of(locale if not locale.is_empty() else TranslationServer.get_locale())
	for candidate: String in [language, SOURCE_LOCALE]:
		var value: Variant = record.get("%s_%s" % [field, candidate])
		if value is String and not (value as String).is_empty():
			return value
	return ""


## "tr_TR" -> "tr", "pt-BR" -> "pt", "" -> "en".
static func language_of(locale: String) -> String:
	var language: String = locale.replace("-", "_").get_slice("_", 0).to_lower()
	return language if not language.is_empty() else SOURCE_LOCALE
