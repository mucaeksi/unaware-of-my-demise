shader_type canvas_item;
// Static ink/stone atmosphere; no TIME, alpha respects fades and text sits on solid panels.
void fragment() {
	vec4 tint = COLOR;
	vec2 p = UV;
	float warm = exp(-9.0 * length(p - vec2(0.84, 0.12)));
	float cool = exp(-8.0 * length(p - vec2(0.15, 0.82)));
	float grain = fract(sin(dot(floor(p * vec2(1080.0, 1920.0)), vec2(12.9898, 78.233))) * 43758.5453);
	vec3 ink = vec3(0.043, 0.051, 0.067);
	vec3 color = ink + warm * vec3(0.040, 0.024, 0.021) + cool * vec3(0.013, 0.022, 0.027);
	color += (grain - 0.5) * 0.005;
	COLOR = vec4(color, 1.0) * tint;
}
