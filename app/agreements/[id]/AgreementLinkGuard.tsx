"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "../../../lib/supabase/browser";

async function createPrivateToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const token=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");return{token,hash}}

export default function AgreementLinkGuard({agreementId,children}:{agreementId:string;children:ReactNode}){
 const [notice,setNotice]=useState("");
 useEffect(()=>{const handler=async(e:MouseEvent)=>{const target=e.target as HTMLElement|null;const button=target?.closest("button");if(!button||button.textContent?.trim()!=="Copy link")return;e.preventDefault();e.stopImmediatePropagation();const old=button.textContent;try{button.textContent="Generating private link…";button.setAttribute("disabled","");const {token,hash}=await createPrivateToken();const s=createClient();const {error}=await s.rpc("issue_agreement_access_token",{p_agreement_id:agreementId,p_token_hash:hash});if(error)throw error;await navigator.clipboard.writeText(`${window.location.origin}/agreement/${token}`);setNotice("Secure client agreement link copied to clipboard.")}catch(err){setNotice(err instanceof Error?err.message:"Unable to generate the private client link.")}finally{button.removeAttribute("disabled");button.textContent=old;setTimeout(()=>setNotice(""),5000)}};document.addEventListener("click",handler,true);return()=>document.removeEventListener("click",handler,true)},[agreementId]);
 return <>{children}{notice&&<div style={{position:"fixed",right:20,bottom:20,zIndex:100,background:"#111318",color:"#fff",padding:"12px 15px",borderRadius:10,fontSize:12,boxShadow:"0 12px 35px rgba(0,0,0,.2)"}}>{notice}</div>}</>;
}
