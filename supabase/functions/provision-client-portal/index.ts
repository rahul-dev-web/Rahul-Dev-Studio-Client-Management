import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"https://rahul-dev-studio-client-management.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
const tempPassword=()=>crypto.getRandomValues(new Uint8Array(18)).reduce((s,b)=>s+"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b%64],"");
const clientCode=()=>`RDSC-${crypto.getRandomValues(new Uint8Array(4)).reduce((s,b)=>s+b.toString(16).padStart(2,"0"),"").toUpperCase()}`;

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization"); if(!auth)return json({error:"Authentication required."},401);
  const url=Deno.env.get("SUPABASE_URL"); const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceKey) return json({error:"Server provisioning configuration is incomplete."},500);
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const token=auth.replace(/^Bearer\s+/i,""); const {data:userData,error:userError}=await admin.auth.getUser(token);
  if(userError||!userData.user)return json({error:"Authentication required."},401);
  const {data:profile,error:profileLookupError}=await admin.from("profiles").select("id,role").eq("id",userData.user.id).single();
  if(profileLookupError) return json({error:"Unable to verify developer authorization."},500);
  if(profile?.role!=="developer")return json({error:"Developer authorization required."},403);
  const body=await req.json().catch(()=>null); const agreementId=typeof body?.agreementId==="string"?body.agreementId:"";
  if(!agreementId)return json({error:"agreementId is required."},400);
  const {data:agreement,error:agreementError}=await admin.from("agreements").select("id,status,client_id,deal_id").eq("id",agreementId).single();
  if(agreementError||!agreement)return json({error:"Agreement not found."},404);
  if(agreement.status!=="executed")return json({error:"Client access can only be provisioned after the agreement is executed."},409);
  const {data:deal,error:dealError}=await admin.from("deals").select("id,developer_id,client_id,client_name,client_email,organization").eq("id",agreement.deal_id).single();
  if(dealError||!deal)return json({error:"Deal not found."},404);
  if(deal.developer_id!==userData.user.id)return json({error:"You do not own this agreement."},403);
  const email=(deal.client_email||"").trim().toLowerCase(); if(!email)return json({error:"The deal does not have a client email address."},409);
  const password=tempPassword(); let clientUserId:string|undefined=agreement.client_id||deal.client_id||undefined;
  if(clientUserId){const {data:existing,error}=await admin.auth.admin.getUserById(clientUserId);if(error||!existing.user) clientUserId=undefined;}
  if(!clientUserId){const {data:usersData,error:usersError}=await admin.auth.admin.listUsers({page:1,perPage:1000});if(usersError) throw new Error(`Unable to search existing users: ${usersError.message}`);const existing=usersData.users.find(u=>(u.email||"").trim().toLowerCase()===email);if(existing) clientUserId=existing.id;}
  if(clientUserId){const {error:updateError}=await admin.auth.admin.updateUserById(clientUserId,{email,password,email_confirm:true,user_metadata:{full_name:deal.client_name,organization:deal.organization,role:"client"}});if(updateError) throw new Error(`Unable to update client account: ${updateError.message}`);}
  else {const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:deal.client_name,organization:deal.organization,role:"client"}});if(createError||!created.user) throw new Error(`Unable to create client account: ${createError?.message||"unknown error"}`);clientUserId=created.user.id;}
  const {data:currentProfile,error:currentProfileError}=await admin.from("profiles").select("client_code").eq("id",clientUserId).maybeSingle();if(currentProfileError) throw new Error(`Unable to load client profile: ${currentProfileError.message}`);
  const code=currentProfile?.client_code||clientCode();const {error:profileError}=await admin.from("profiles").upsert({id:clientUserId,role:"client",full_name:deal.client_name,client_code:code,must_change_password:true,updated_at:new Date().toISOString()},{onConflict:"id"});if(profileError) throw new Error(`Unable to save client profile: ${profileError.message}`);
  const {error:dealUpdateError}=await admin.from("deals").update({client_id:clientUserId}).eq("id",deal.id);if(dealUpdateError) throw new Error(`Unable to link deal: ${dealUpdateError.message}`);
  const {error:agreementUpdateError}=await admin.from("agreements").update({client_id:clientUserId}).eq("id",agreement.id);if(agreementUpdateError) throw new Error(`Unable to link agreement: ${agreementUpdateError.message}`);
  const {data:project,error:projectLookupError}=await admin.from("projects").select("id").eq("agreement_id",agreement.id).maybeSingle();if(projectLookupError) throw new Error(`Unable to load project: ${projectLookupError.message}`);if(project){const {error:projectUpdateError}=await admin.from("projects").update({client_id:clientUserId}).eq("id",project.id);if(projectUpdateError)throw new Error(`Unable to link project: ${projectUpdateError.message}`);}
  const {error:auditError}=await admin.from("audit_log").insert({actor_id:userData.user.id,actor_role:"developer",action:"client_portal_provisioned",entity_type:"agreement",entity_id:agreement.id,metadata:{client_id:clientUserId,client_code:code}});if(auditError) console.error("Audit insert failed",auditError.message);
  return json({clientId:code,email,temporaryPassword:password,mustChangePassword:true,message:"Client portal credentials generated successfully."});
 }catch(error){console.error("Client provisioning failed",error);return json({error:error instanceof Error?error.message:"Unable to provision client portal."},500);}
});