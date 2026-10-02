import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { register, login } from "./auth.js";
import { banners, draw } from "./gacha.js";
import { pool, tx } from "./db.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || "dev" });

async function auth(req: any) { await req.jwtVerify(); }
function requireAdmin(req: any, rep: any) {
  if (!process.env.ADMIN_API_TOKEN || req.headers["x-admin-token"] !== process.env.ADMIN_API_TOKEN) {
    rep.code(401).send({ error: "Unauthorized" }); return false;
  }
  return true;
}
async function audit(actor: string, action: string, entityType?: string, entityId?: string, payload?: any) {
  await pool.query("insert into audit_log(actor,action,entity_type,entity_id,payload) values($1,$2,$3,$4,$5)",[actor,action,entityType || null,entityId || null,payload ? JSON.stringify(payload) : null]);
}

app.get("/health", async () => ({ ok: true }));
app.post("/v1/auth/register", async (req:any,rep) => { try { const b=req.body; if(!b?.email||!b?.password||!b?.displayName)return rep.code(400).send({error:"required"}); const u=await register(b.email,b.password,b.displayName); return {token:await rep.jwtSign(u),user:u}; } catch(e:any){return rep.code(e.statusCode||500).send({error:e.message});} });
app.post("/v1/auth/login", async (req:any,rep) => { try { const u=await login(req.body.email,req.body.password); return {token:await rep.jwtSign(u),user:u}; } catch(e:any){return rep.code(e.statusCode||500).send({error:e.message});} });
app.get("/v1/me",{preHandler:auth},async(req:any)=>req.user);
app.get("/v1/gacha/banners",{preHandler:auth},async()=>({banners:await banners()}));
app.post("/v1/gacha/draw/:id",{preHandler:auth},async(req:any,rep)=>{try{const q=req.body?.quantity===10?10:1;const rid=req.body?.requestId||crypto.randomUUID();return await draw(req.user.playerId,req.params.id,q,rid)}catch(e:any){return rep.code(e.statusCode||500).send({error:e.message});}});

// ---------- Admin API ----------
app.get("/v1/admin/dashboard", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const [p,b,i,d]=await Promise.all([
  pool.query("select count(*)::int as n from players"),
  pool.query("select count(*)::int as n from gacha_banners where active=true"),
  pool.query("select count(*)::int as n from items where rarity>=5"),
  pool.query("select count(*)::int as n from gacha_draws where created_at::date=current_date")
]);return {players:p.rows[0].n,activeBanners:b.rows[0].n,fiveStarItems:i.rows[0].n,drawsToday:d.rows[0].n};});

app.get("/v1/admin/players", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const s=String(req.query?.search||"").trim();const like=`%${s}%`;const r=await pool.query(`select p.id,p.email,p.display_name,p.created_at,w.soft_currency,w.premium_currency,coalesce(i.inventory_count,0)::int as inventory_count from players p left join wallets w on w.player_id=p.id left join (select player_id,count(*) as inventory_count from player_inventory where quantity>0 group by player_id) i on i.player_id=p.id where ($1='' or p.email ilike $2 or p.display_name ilike $2) order by p.created_at desc limit 200`,[s,like]);return {players:r.rows};});
app.post("/v1/admin/players/:id/grant", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const soft=Math.max(0,Number(req.body?.softCurrency||0));const premium=Math.max(0,Number(req.body?.premiumCurrency||0));await tx(async c=>{const r=await c.query("update wallets set soft_currency=soft_currency+$1,premium_currency=premium_currency+$2,updated_at=now() where player_id=$3 returning *",[soft,premium,req.params.id]);if(!r.rowCount)throw Object.assign(new Error("Player wallet not found"),{statusCode:404});});await audit("admin","grant_currency","player",req.params.id,{soft,premium,reason:req.body?.reason||""});return {ok:true};});

app.get("/v1/admin/items", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const r=await pool.query("select id,code,name,rarity,kind from items order by rarity desc,name asc");return {items:r.rows};});
app.post("/v1/admin/items", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const b=req.body||{};if(!b.code||!b.name)return rep.code(400).send({error:"code and name required"});try{const r=await pool.query("insert into items(code,name,rarity,kind) values($1,$2,$3,$4) returning id,code,name,rarity,kind",[String(b.code).trim(),String(b.name).trim(),Number(b.rarity||1),String(b.kind||"character")]);await audit("admin","create_item","item",r.rows[0].id,r.rows[0]);return r.rows[0];}catch(e:any){return rep.code(409).send({error:e.code==="23505"?"Duplicate item code":e.message});}});

app.get("/v1/admin/banners", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const r=await pool.query("select id,code,name,active,single_cost,ten_cost,pity_5,pity_4,created_at from gacha_banners order by created_at desc");return {banners:r.rows};});
app.post("/v1/admin/banners", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const b=req.body||{};if(!b.code||!b.name)return rep.code(400).send({error:"code and name required"});try{const r=await pool.query("insert into gacha_banners(code,name,active,single_cost,ten_cost,pity_5,pity_4) values($1,$2,false,$3,$4,$5,$6) returning *",[String(b.code).trim(),String(b.name).trim(),Number(b.singleCost||160),Number(b.tenCost||1600),Number(b.pity5||80),Number(b.pity4||10)]);await audit("admin","create_banner","gacha_banner",r.rows[0].id,r.rows[0]);return r.rows[0];}catch(e:any){return rep.code(409).send({error:e.code==="23505"?"Duplicate banner code":e.message});}});
app.post("/v1/admin/banners/:id/active", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const active=!!req.body?.active;const r=await pool.query("update gacha_banners set active=$1 where id=$2 returning id,code,name,active,single_cost,ten_cost,pity_5,pity_4",[active,req.params.id]);if(!r.rowCount)return rep.code(404).send({error:"Not found"});await audit("admin",active?"activate_banner":"deactivate_banner","gacha_banner",req.params.id,{active});return r.rows[0];});
app.get("/v1/admin/banners/:id/entries", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const r=await pool.query("select ge.item_id,i.code,i.name,ge.rarity,ge.weight,ge.featured from gacha_entries ge join items i on i.id=ge.item_id where ge.banner_id=$1 order by ge.rarity desc,i.name asc",[req.params.id]);return {entries:r.rows};});
app.put("/v1/admin/banners/:id/entries", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const entries=Array.isArray(req.body?.entries)?req.body.entries:[];if(!entries.length)return rep.code(400).send({error:"Banner pool cannot be empty"});await tx(async c=>{await c.query("delete from gacha_entries where banner_id=$1",[req.params.id]);for(const e of entries){await c.query("insert into gacha_entries(banner_id,item_id,rarity,weight,featured) values($1,$2,$3,$4,$5)",[req.params.id,e.item_id,Number(e.rarity),Math.max(1,Number(e.weight)),!!e.featured]);}});await audit("admin","replace_banner_pool","gacha_banner",req.params.id,{count:entries.length});return {ok:true};});

app.get("/v1/admin/draws", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const limit=Math.min(500,Math.max(1,Number(req.query?.limit||100)));const r=await pool.query("select d.id,d.player_id,d.banner_id,b.name as banner_name,d.quantity,d.cost,d.request_id,d.created_at from gacha_draws d left join gacha_banners b on b.id=d.banner_id order by d.created_at desc limit $1",[limit]);return {draws:r.rows};});
app.get("/v1/admin/audit", async(req:any,rep)=>{if(!requireAdmin(req,rep))return;const limit=Math.min(500,Math.max(1,Number(req.query?.limit||100)));const r=await pool.query("select id,actor,action,entity_type,entity_id,payload,created_at from audit_log order by created_at desc limit $1",[limit]);return {logs:r.rows};});

app.get("/v1/content/manifest",async()=>{try{return JSON.parse(await fs.readFile(path.resolve(process.cwd(),"../patch/manifests/manifest.json"),"utf8"));}catch{return {schema:1,min_app_version:process.env.CLIENT_APP_VERSION||"1.0.0",latest_content_version:process.env.LATEST_CONTENT_VERSION||"0.0.0",patches:[]};}});
app.get("/content/:file",async(req:any,rep)=>{const f=path.basename(req.params.file);try{return rep.type("application/octet-stream").send(await fs.readFile(path.resolve(process.cwd(),"../patch/files",f)));}catch{return rep.code(404).send({error:"Not found"});}});

await app.listen({host:"0.0.0.0",port:Number(process.env.PORT||8080)});
