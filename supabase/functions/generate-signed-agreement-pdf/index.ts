import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders={"Access-Control-Allow-Origin":"https://rahul-dev-studio-client-management.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization");if(!auth)return json({error:"Unauthorized"},401);
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const token=auth.replace(/^Bearer\s+/i,"");const {data:userData}=await admin.auth.getUser(token);if(!userData.user)return json({error:"Unauthorized"},401);
  const {data:profile}=await admin.from("profiles").select("id,role,full_name").eq("id",userData.user.id).single();if(!profile||profile.role!=="developer")return json({error:"Developer access required"},403);
  const {agreementId}=await req.json();if(!agreementId)return json({error:"agreementId is required"},400);
  const [{data:agreement,error:ae},{data:signatures}]=await Promise.all([admin.from("agreements").select("id,agreement_code,deal_id,client_id,status,version,executed_at").eq("id",agreementId).single(),admin.from("signatures").select("signer_role,signer_name,signature_data,signed_at").eq("agreement_id",agreementId).order("signed_at")]);
  if(ae||!agreement)return json({error:ae?.message||"Agreement not found"},404);if(agreement.status!=="executed")return json({error:"Agreement must be executed first"},409);if(!signatures?.some(s=>s.signer_role==="client")||!signatures?.some(s=>s.signer_role==="developer"))return json({error:"Both signatures are required"},409);
  const [{data:deal},{data:scope},{data:deliverables}]=await Promise.all([admin.from("deals").select("*").eq("id",agreement.deal_id).single(),admin.from("deal_scope").select("title,item_order").eq("deal_id",agreement.deal_id).order("item_order"),admin.from("deal_deliverables").select("title,item_order").eq("deal_id",agreement.deal_id).order("item_order")]);
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);let page=pdf.addPage([595,842]);let y=800;const margin=48;
  const line=(text:string,size=10,isBold=false)=>{if(y<55){page=pdf.addPage([595,842]);y=800;}page.drawText(String(text).slice(0,105),{x:margin,y,size,font:isBold?bold:font,color:rgb(.08,.09,.12)});y-=size+7;};const section=(title:string)=>{y-=8;line(title,12,true);};
  line("RAHUL DEVELOPMENT STUDIO",16,true);line("PROJECT DEVELOPMENT AGREEMENT — FINAL SIGNED COPY",12,true);line(`Agreement: ${agreement.agreement_code}   Version: ${agreement.version}`,9);line(`Executed: ${new Date(agreement.executed_at).toLocaleString("en-IN")}`,9);section("1. Parties & Project");line(`Client: ${deal?.client_name||"Client"}`);line(`Organization: ${deal?.organization||"—"}`);line(`Project: ${deal?.project_name||"—"}`);line(`Type: ${deal?.project_type||"—"}`);line(`Technology: ${deal?.technology||"—"}`);section("2. Project Scope");line(deal?.project_description||"As agreed in the project brief.");for(const item of scope||[])line(`• ${item.title}`);section("3. Deliverables");for(const item of deliverables||[])line(`• ${item.title}`);section("4. Commercial Terms");line(`Total: INR ${deal?.total_amount??0}`);line(`Advance: INR ${deal?.advance_amount??0}`);line(`Remaining: INR ${deal?.remaining_amount??0}`);line(`Payment schedule: ${deal?.payment_schedule||"As mutually agreed"}`);section("5. Timeline & Support");line(`Start: ${deal?.start_date||"To be agreed"}`);line(`Expected delivery: ${deal?.expected_delivery_date||"To be agreed"}`);line(`Revision rounds: ${deal?.revision_rounds??2}`);line(`Bug-fix support: ${deal?.support_days??20} days`);section("6. Electronic Signatures");for(const sig of signatures||[]){line(`${sig.signer_role==="client"?"CLIENT":"DEVELOPER"}: ${sig.signer_name}`,10,true);line(`Signature: ${sig.signature_data}`);line(`Signed at: ${new Date(sig.signed_at).toLocaleString("en-IN")}`,9);}y-=12;line("FINAL EXECUTED VERSION — SIGNED RECORD IS IMMUTABLE",9,true);
  const bytes=await pdf.save();const hashBuffer=await crypto.subtle.digest("SHA-256",bytes);const hash=Array.from(new Uint8Array(hashBuffer),b=>b.toString(16).padStart(2,"0")).join("");const path=`${agreement.agreement_code}/v${agreement.version}/signed-final.pdf`;
  const {error:uploadError}=await admin.storage.from("signed-agreements").upload(path,bytes,{contentType:"application/pdf",upsert:true});if(uploadError)return json({error:uploadError.message},500);
  const {error:documentError}=await admin.from("agreement_documents").upsert({agreement_id:agreement.id,version:agreement.version,document_type:"signed_final",storage_bucket:"signed-agreements",storage_path:path,content_hash:hash},{onConflict:"agreement_id,version,document_type"});if(documentError)return json({error:documentError.message},500);
  await admin.from("audit_log").insert({actor_id:userData.user.id,actor_role:"developer",action:"signed_pdf_generated",entity_type:"agreement",entity_id:agreement.id,metadata:{version:agreement.version,storage_path:path,content_hash:hash}});
  return json({ok:true,storagePath:path,contentHash:hash});
 }catch(error){console.error("Signed PDF generation failed",error);return json({error:error instanceof Error?error.message:"Unable to generate signed PDF"},500);}
});