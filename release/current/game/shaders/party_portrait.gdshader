shader_type canvas_item;
render_mode unshaded;

uniform float brightness : hint_range(0.0, 1.5) = 1.0;

void fragment() {
	float edge = length(UV - vec2(0.5));
	float feather = max(fwidth(edge), 0.001);
	float mask = 1.0 - smoothstep(0.49 - feather, 0.49, edge);
	COLOR.rgb *= brightness;
	COLOR.a *= mask;
}
