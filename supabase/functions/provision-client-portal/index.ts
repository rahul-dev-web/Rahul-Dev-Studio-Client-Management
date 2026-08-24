import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"https://rahul-dev-studio-client-management.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const tempPassword=()=>crypto.getRandomValues(new Uint8Array(18)).reduce((s,b)=>s+"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b%64],"");
const clientCode=()=>`RDSC-${crypto.getRandomValues(new Uint8Array(4)).reduce((s,b)=>s+b.toString(16).padStart(2,"0"),"").toUpperCase()}`;

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization");if(!auth)return json({error:"Authentication required."},401);
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const token=auth.replace(/^Bearer\s+/i,"");const {data:userData,error:userError}=await admin.auth.getUser(token);if(userError||!userData.user)return json({error:"Authentication required."},401);
  const {data:profile}=await admin.from("profiles").select("id,role").eq("id",userData.user.id).single();if(profile?.role!=="developer")return json({error:"Developer authorization required."},403);
  const {agreementId}=await req.json();if(typeof agreementId!=="string"||!agreementId)return json({error:"agreementId is required."},400);
  const {data:agreement,error:agreementError}=await admin.from("agreements").select("id,status,client_id,deal_id").eq("id",agreementId).single();if(agreementError||!agreement)return json({error:"Agreement not found."},404);if(agreement.status!=="executed")return json({error:"Client access can only be provisioned after the agreement is executed."},409);
  const {data:deal,error:dealError}=await admin.from("deals").select("id,developer_id,client_id,client_name,client_email,organization").eq("id",agreement.deal_id).single();if(dealError||!deal||deal.developer_id!==userData.user.id)return json({error:"Deal not found or not owned by the current developer."},404);
  const email=(deal.client_email||"").trim().toLowerCase();if(!email)return json({error:"The deal does not have a client email address."},409);
  const password=tempPassword();let clientUserId=agreement.client_id||deal.client_id||"";
  if(clientUserId){const {data:existing,error}=await admin.auth.admin.getUserById(clientUserId);if(error||!existing.user)return json({error:"The linked client account could not be found."},409);const {error:updateError}=await admin.auth.admin.updateUserById(clientUserId,{password,email_confirm:true});if(updateError)throw updateError;}
  else{const {data:usersData,error:usersError}=await admin.auth.admin.listUsers({page:1,perPage:1000});if(usersError)throw usersError;const existing=usersData.users.find(u=>(u.email||"").toLowerCase()===email);if(existing){clientUserId=existing.id;const {data:existingProfile}=await admin.from("profiles").select("role").eq("id",clientUserId).maybeSingle();if(existingProfile?.role==="developer")return json({error:"This email belongs to a developer account and cannot be provisioned as a client."},409);const {error:updateError}=await admin.auth.admin.updateUserById(clientUserId,{password,email_confirm:true});if(updateError)throw updateError;}else{const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:deal.client_name,organization:deal.organization,role:"client"}});if(createError||!created.user)throw createError||new Error("Unable to create client account.");clientUserId=created.user.id;}}
  const {data:currentProfile}=await admin.from("profiles").select("client_code").eq("id",clientUserId).maybeSingle();const code=currentProfile?.client_code||clientCode();const {error:profileError}=await admin.from("profiles").upsert({id:clientUserId,role:"client",full_name:deal.client_name,client_code:code,must_change_password:true},{onConflict:"id"});if(profileError)throw profileError;
  for(const [table,id] of [["deals",deal.id],["agreements",agreement.id]] as const){const {error}=await admin.from(table).update({client_id:clientUserId}).eq("id",id);if(error)throw error;}
  const {data:project}=await admin.from("projects").select("id").eq("agreement_id",agreement.id).maybeSingle();if(project){const {error}=await admin.from("projects").update({client_id:clientUserId}).eq("id",project.id);if(error)throw error;}
  await admin.from("audit_log").insert({actor_id:userData.user.id,actor_role:"developer",action:"client_portal_provisioned",entity_type:"agreement",entity_id:agreement.id,metadata:{client_id:clientUserId,client_code:code}});
  return json({clientId:code,email,temporaryPassword:password,mustChangePassword:true,message:"Client portal credentials generated. Share the temporary password once and require a password change on first login."});
 }catch(error){console.error("Client provisioning failed",error);return json({error:error instanceof Error?error.message:"Unable to provision client portal."},500);}
});