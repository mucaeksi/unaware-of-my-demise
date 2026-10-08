shader_type canvas_item;
render_mode unshaded;

// Quiet static light behind the mark: two radial fields and grain, no moving focus-dependent effect.
void fragment() {
	vec4 tint = COLOR;
	vec2 p = UV - vec2(0.5, 0.44);
	float halo = exp(-dot(p * vec2(2.8, 3.0), p * vec2(2.8, 3.0)) * 2.0);
	float wine = exp(-dot((UV - vec2(0.57, 0.47)) * vec2(3.0, 4.0), (UV - vec2(0.57, 0.47)) * vec2(3.0, 4.0)) * 2.0);
	float grain = fract(sin(dot(FRAGCOORD.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
	vec3 base = vec3(0.027, 0.032, 0.042);
	vec3 color = base + vec3(0.015, 0.017, 0.021) * halo + vec3(0.016, 0.002, 0.005) * wine;
	color += grain * 0.006;
	COLOR = vec4(color, 1.0) * tint;
}
