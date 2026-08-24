import { ReactNode } from "react";
import AgreementLinkGuard from "./AgreementLinkGuard";

export default async function AgreementLayout({children,params}:{children:ReactNode;params:Promise<{id:string}>}){
 const {id}=await params;
 return <AgreementLinkGuard agreementId={id}>{children}</AgreementLinkGuard>;
}
