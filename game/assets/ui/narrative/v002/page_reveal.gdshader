shader_type canvas_item;
render_mode unshaded;

uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform sampler2D previous_page : filter_linear;
uniform bool has_previous = false;
uniform vec4 ink : source_color = vec4(0.025, 0.018, 0.026, 1.0);
uniform vec4 blood : source_color = vec4(0.32, 0.045, 0.065, 1.0);

void fragment() {
	// A frozen outgoing page fades into an eclipse, then a broad veil drifts away.
	// One texture sample and two slow waves; no screen readback or repeated viewport redraw.
	float envelope = sin(progress * 3.14159265);
	float drift = (sin(UV.x * 6.0 + UV.y * 3.0 + progress * 2.0)
		+ sin(UV.y * 5.0 - UV.x * 2.0 - progress)) * 0.035 * envelope;
	float coverage = 1.0 - smoothstep(0.32, 1.0, progress + drift);
	vec3 veil = ink.rgb + blood.rgb * (0.5 + drift * 3.0) * envelope * 0.08;
	if (has_previous) {
		float outgoing = 1.0 - smoothstep(0.0, 0.40, progress);
		veil = mix(veil, texture(previous_page, UV).rgb, outgoing);
	}
	COLOR = vec4(veil, coverage) * COLOR;
}
