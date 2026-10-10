// Fadyme production-only canvas effect. Swirl function adapted from GDQuest MIT (see licenses/).
shader_type canvas_item;
render_mode unshaded;
uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform bool reduced_motion = false;
uniform vec4 veil_color : source_color = vec4(0.56, 0.44, 0.71, 1.0);
uniform vec4 silver_color : source_color = vec4(0.86, 0.86, 0.94, 1.0);
float ring(vec2 p, float radius, float thickness) {return 1.0-smoothstep(thickness, thickness+0.008, abs(length(p)-radius));}
float swirl(vec2 uv, float size, int arms, float offset) {
 float angle = atan(-uv.y+0.5, uv.x-0.5)-offset;
 float len = length(uv-vec2(0.5,0.5));
 return sin(len*size+angle*float(arms));
}
void fragment() {
 vec2 p = UV-vec2(0.5);
 float t = reduced_motion ? 0.42 : progress;
 float envelope = smoothstep(0.0,0.08,progress)*(1.0-smoothstep(0.72,1.0,progress));
 float shape = 0.0;
 float accent = 0.0;
 vec2 q = vec2(p.x,p.y*1.6);
 shape = ring(q,0.10+0.25*t,0.006)+ring(q,0.035+0.20*t,0.006)*0.6;
 float curtain = (1.0-smoothstep(0.03,0.30,length(p)))*max(swirl(UV,32.0,5,t*1.2),0.0)*0.23;
 shape += curtain;
 accent = ring(p-vec2(0.0,-0.05),0.075,0.007)*step(p.y,-0.025);
 accent += (1.0-smoothstep(0.004,0.010,abs(p.y+0.025)))*step(abs(p.x),0.085);
 float alpha = clamp(shape+accent,0.0,0.86)*envelope;
 vec3 col = mix(veil_color.rgb,silver_color.rgb,clamp(accent+shape*0.35,0.0,1.0));
 COLOR = vec4(col,alpha);
}
