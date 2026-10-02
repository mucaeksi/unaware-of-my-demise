extends Node
var base_url="http://127.0.0.1:8080"
var token=""
func set_base_url(v): base_url=v.trim_suffix("/")
func req(path,method,payload={}):
 var r=HTTPRequest.new(); add_child(r); var h=PackedStringArray(["Content-Type: application/json"]); if token!="": h.append("Authorization: Bearer "+token); var body=JSON.stringify(payload) if payload.size()>0 else ""; var e=r.request(base_url+path,h,method,body); if e!=OK: r.queue_free(); return {"ok":false,"error":str(e)}; var c=await r.request_completed; r.queue_free(); var d=JSON.parse_string((c[3] as PackedByteArray).get_string_from_utf8()); if typeof(d)!=TYPE_DICTIONARY:d={}; d["ok"]=c[1]>=200 and c[1]<300; return d
func login(e,p): var d=await req("/v1/auth/login",HTTPClient.METHOD_POST,{"email":e,"password":p}); if d.ok: token=d.token; return d
func register(e,p,n): var d=await req("/v1/auth/register",HTTPClient.METHOD_POST,{"email":e,"password":p,"displayName":n}); if d.ok: token=d.token; return d
func get_banners(): return await req("/v1/gacha/banners",HTTPClient.METHOD_GET)
func draw(id,q): return await req("/v1/gacha/draw/"+id,HTTPClient.METHOD_POST,{"quantity":q,"requestId":client_uuid()})
func manifest(): return await req("/v1/content/manifest",HTTPClient.METHOD_GET)
func client_uuid():
 var b=PackedByteArray(); for i in 16:b.append(randi()%256); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128; var h=""; for x in b:h+="%02x"%x; return "%s-%s-%s-%s-%s"%[h.substr(0,8),h.substr(8,4),h.substr(12,4),h.substr(16,4),h.substr(20,12)]
