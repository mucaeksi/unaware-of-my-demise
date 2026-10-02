extends Control
var banner_id=""
func _ready():
 ApiClient.set_base_url("http://127.0.0.1:8080");PatchManager.server_base_url=ApiClient.base_url;$Login.pressed.connect(login);$Register.pressed.connect(register);$Draw1.pressed.connect(func():do_draw(1));$Draw10.pressed.connect(func():do_draw(10));$Status.text="Backend: "+ApiClient.base_url
func login():
 var d=await ApiClient.login($Email.text,$Password.text);$Status.text="Login OK" if d.ok else "Login failed: "+str(d.get("error"));if d.ok:await load_game()
func register():
 var d=await ApiClient.register($Email.text,$Password.text,"Player");$Status.text="Register OK" if d.ok else "Register failed: "+str(d.get("error"));if d.ok:await load_game()
func load_game():
 var m=await PatchManager.check_and_apply();if not m.ok:$Results.append_text("Patch: "+str(m.error)+"\n");var d=await ApiClient.get_banners();if not d.ok:return;var b=d.banners[0];banner_id=str(b.id);$Banner.text="%s\n1x %s | 10x %s"%[b.name,b.single_cost,b.ten_cost]
func do_draw(q):
 if banner_id=="":return;var d=await ApiClient.draw(banner_id,q);if not d.ok:$Results.append_text("Draw failed: "+str(d.error)+"\n");return;for i in d.results:$Results.append_text("%s★ %s (%s)\n"%[i.rarity,i.name,i.code])
