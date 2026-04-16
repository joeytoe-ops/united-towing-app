import { SVC, TAX, CC_FEE } from "./constants";
import { LOGO_B64 } from "./logo";

export async function makePDF(job) {
  if (!window.jspdf) {
    await new Promise((ok,no) => {
      const s = document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload=ok; s.onerror=no; document.head.appendChild(s);
    });
  }
  const{jsPDF}=window.jspdf; const doc=new jsPDF({unit:"pt",format:"letter"});
  const w=612,m=36,pw=w-72; let y=m;
  const dk=[26,26,46],bl=[26,10,110],wt=[255,255,255];
  const svc=job.services||{}; const tl=parseFloat(job.tolls)||0;
  const sv=SVC.reduce((a,i)=>a+(parseFloat(svc[i.k])||0),0)+(parseFloat(svc.custom1)||0)+(parseFloat(svc.custom2)||0)+(parseFloat(svc.custom3)||0);
  const pdfTaxRate=job.taxMode==="exempt"?0:(job.taxRate!=null?parseFloat(job.taxRate):TAX);
  const sub=sv+tl, tax=Math.round(sv*pdfTaxRate*100)/100;
  const chargeBase=sv+tax+tl;
  const cc=job.paymentType==="Credit Card"?Math.round(chargeBase*CC_FEE*100)/100:0;
  const tot=Math.round((chargeBase+cc)*100)/100;
  const bx=(x,by,bw,bh,lb,vl,vs)=>{vs=vs||10;doc.setDrawColor(51);doc.setLineWidth(.5);doc.rect(x,by,bw,bh);doc.setFontSize(6);doc.setFont("helvetica","normal");doc.setTextColor(...dk);doc.text(lb,x+3,by+8);if(vl){doc.setFontSize(vs);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(String(vl),x+4,by+bh-4);doc.setTextColor(...dk)}};
  const ck=(x,cy,on)=>{doc.rect(x,cy,9,9);if(on){doc.setFontSize(7);doc.setFont("helvetica","bold");doc.text("X",x+2,cy+7.5)}};
  doc.setFillColor(...dk);doc.rect(m,y,pw,32,"F");doc.setTextColor(...wt);doc.setFontSize(22);doc.setFont("helvetica","bold");doc.text("24 HOUR TOWING",w/2,y+24,{align:"center"});y+=36;
  /* Logos on left and right, text in center */
  const logoW=55,logoH=Math.round(55*119/150);
  try{doc.addImage(LOGO_B64,"PNG",m+4,y,logoW,logoH)}catch{};
  try{doc.addImage(LOGO_B64,"PNG",m+pw-logoW-4,y,logoW,logoH)}catch{};
  doc.setTextColor(...dk);doc.setFontSize(18);doc.setFont("helvetica","bold");doc.text("UNITED",w/2,y+16,{align:"center"});
  doc.setFontSize(8);doc.setFont("helvetica","normal");doc.text("TOWING & TRANSPORT",w/2,y+26,{align:"center"});
  doc.setFontSize(7);doc.text('"Local & Long Distance"     "Flatbed Specialists"',w/2,y+35,{align:"center"});
  doc.setFontSize(6);doc.text("Towing \u2022 Emergency Starting \u2022 Battery Service \u2022 Flat Tire Service",w/2,y+43,{align:"center"});
  doc.text("Vehicle Locksmith Services \u2022 Unauthorized Tows \u2022 Fuel Delivery",w/2,y+50,{align:"center"});
  y+=Math.max(logoH,52)+6;
  doc.setFillColor(30,58,95);doc.rect(m,y,pw,30,"F");doc.setTextColor(255,255,255);doc.setFontSize(24);doc.setFont("helvetica","bold");doc.text("914-500-5570",w/2,y+22,{align:"center"});doc.setTextColor(...dk);y+=32;
  const rh=26,dw=pw*.6,tw=pw*.4;
  const ts=job.jobTime||"";const hr=parseInt(ts.split(":")[0]||"12");const ap=hr>=12?"PM":"AM";
  const dh=hr>12?hr-12:(hr===0?12:hr);const dt=dh+":"+(ts.split(":")[1]||"00");
  const ds=job.jobDate?new Date(job.jobDate+"T12:00:00").toLocaleDateString("en-US"):"";
  bx(m,y,dw,rh,"DATE:",ds);doc.rect(m+dw,y,tw,rh);doc.setFontSize(6);doc.setFont("helvetica","normal");doc.setTextColor(...dk);doc.text("TIME:",m+dw+3,y+8);
  if(ts){doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(dt,m+dw+4,y+rh-4);doc.setTextColor(...dk)}
  const ax=m+dw+tw-62,px=m+dw+tw-30,cy2=y+8;ck(ax,cy2,ap==="AM");doc.setFontSize(7);doc.setFont("helvetica","bold");doc.text("AM",ax+11,cy2+7);ck(px,cy2,ap==="PM");doc.text("PM",px+11,cy2+7);y+=rh;
  bx(m,y,dw,rh,"CUSTOMER:",job.customer?.name||"");bx(m+dw,y,tw,rh,"PHONE:",job.customer?.phone||"");y+=rh;
  bx(m,y,dw,rh,"PICKUP LOCATION:",job.pickup||"");bx(m+dw,y,tw,rh,"CITY:",job.pickupCity||"");y+=rh;
  bx(m,y,dw,rh,"DELIVERY LOCATION:",job.dropoff||"");bx(m+dw,y,tw,rh,"CITY:",job.dropoffCity||"");y+=rh;
  const vc=[[.1,"YR:",job.vehicle?.year],[.14,"MAKE:",job.vehicle?.make],[.14,"MODEL:",job.vehicle?.model],[.14,"COLOR:",job.vehicle?.color],[.48,"VIN:",job.vehicle?.vin]];
  let vx=m;vc.forEach(v=>{bx(vx,y,pw*v[0],rh,v[1],v[2]||"",9);vx+=pw*v[0]});y+=rh;
  const oc=[[.3,"VEHICLE OWNER:",(job.owner?.name||"")],[.22,"HOME PHONE:",(job.owner?.homePhone||"")],[.22,"WORK PHONE:",(job.owner?.workPhone||"")],[.26,"LIC. NO.:",job.vehicle?.plate||""]];
  let ox=m;oc.forEach(o=>{bx(ox,y,pw*o[0],rh,o[1],o[2],9);ox+=pw*o[0]});y+=rh+3;
  const rw2=pw*.52,sw2=pw*.48,sx=m+rw2,hh=16,sr=19,bh2=sr*12;
  doc.rect(m,y,rw2,hh);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text("REMARKS",m+rw2/2,y+12,{align:"center"});
  doc.rect(m,y+hh,rw2,bh2);if(job.notes){doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(job.notes,m+8,y+hh+14);doc.setTextColor(...dk)}
  const pay=job.paymentType||"";if(pay){doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text("PAID "+pay.toUpperCase(),m+8,y+hh+bh2-8);doc.setTextColor(...dk)}
  doc.rect(sx,y,sw2,hh);doc.setFontSize(10);doc.setFont("helvetica","bold");doc.text("SERVICES PERFORMED",sx+sw2/2,y+12,{align:"center"});
  /* Build PDF service rows - standard + custom + totals */
  const pdfR=[["TOWING","towing"],["WAITING TIME","waiting"],["WINCH","winch"],["ROAD SERVICE","road_service"],["GATE FEE","gate_fee"],["ADMIN FEE","admin_fee"],["STORAGE","storage"],["MILEAGE","mileage"],["SPECIAL EQUIP","special_equip"],["CLEAN UP","cleanup"],["SPEEDY DRY","speedy_dry"],["GOA","goa"]];
  /* Add custom fees if they have names */
  if(svc.custom1_name)pdfR.push([svc.custom1_name.toUpperCase(),"custom1"]);
  if(svc.custom2_name)pdfR.push([svc.custom2_name.toUpperCase(),"custom2"]);
  if(svc.custom3_name)pdfR.push([svc.custom3_name.toUpperCase(),"custom3"]);
  pdfR.push(["SUBTOTAL","_s"],["TAX","_t"],["TOLLS","_tl"],["CC PROCESS FEE (4.5%)","_c"],["TOTAL DUE","_tot"]);
  const sr2=Math.min(sr,Math.floor(bh2/pdfR.length));
  let sy=y+hh;pdfR.forEach(r=>{doc.setDrawColor(51);doc.setLineWidth(.5);doc.rect(sx,sy,sw2,sr2);let v="";
    if(r[1]==="_s")v=sv>0?sv.toFixed(2):"";else if(r[1]==="_t")v=tax>0?tax.toFixed(2):"";else if(r[1]==="_tl")v=tl>0?tl.toFixed(2):"";else if(r[1]==="_c")v=cc>0?cc.toFixed(2):"";else if(r[1]==="_tot")v=tot>0?tot.toFixed(2):"";else{const sv2=parseFloat(svc[r[1]])||0;if(sv2>0)v=sv2.toFixed(2)}
    ck(sx+5,sy+Math.max(2,(sr2-9)/2),!!v);const it=r[0]==="TOTAL DUE";doc.setFontSize(it?8:7);doc.setFont("helvetica",it?"bold":"normal");doc.setTextColor(...dk);doc.text(r[0],sx+20,sy+sr2-Math.max(4,sr2*.25));
    if(v){doc.setFontSize(it?10:9);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(v,sx+sw2-6,sy+sr2-Math.max(4,sr2*.25),{align:"right"});doc.setTextColor(...dk)}sy+=sr2});
  y+=hh+bh2+3;
  const lw=pw*.52,rw3=pw*.48,blh=52;doc.rect(m,y,lw,blh);doc.setFontSize(9);doc.setFont("helvetica","bold");doc.text("DAMAGE WAIVER",m+lw/2,y+12,{align:"center"});
  doc.setFontSize(5.5);doc.setFont("helvetica","normal");
  ["I acknowledge towing or servicing the above referenced vehicle may result","in damage or loss, including loss or theft of personal items. I assume","full responsibility and release United Towing & Transport LLC and it's","representatives from any liability."].forEach((l,i)=>doc.text(l,m+4,y+22+i*7));
  doc.rect(m+lw,y,rw3,blh);doc.setFontSize(8);let py2=y+14;
  ["CASH","CK#","CHARGE ACCOUNT"].forEach(pm=>{ck(m+lw+8,py2-3,pay.toUpperCase()===pm.split("#")[0].trim());doc.setFont("helvetica","normal");doc.text(pm,m+lw+20,py2+4);py2+=12});
  y+=blh+2;
  bx(m,y,pw*.5,20,"P.O.#",job.poNumber||"");bx(m+pw*.5,y,pw*.5,20,"R.A.#",job.raNumber||"");y+=23;
  doc.setFontSize(7);doc.text("x ___________________________________",m,y+8);doc.text("OWNER / AGENT",m+20,y+16);y+=22;
  doc.rect(m,y,lw,36);doc.setFontSize(8);doc.setFont("helvetica","bold");doc.text("ACKNOWLEDGMENT",m+lw/2,y+10,{align:"center"});
  doc.setFontSize(5.5);doc.setFont("helvetica","normal");doc.text("I acknowledge receipt of the above referenced vehicle and hereby",m+4,y+20);doc.text("release United Towing & Transport LLC from all liability.",m+4,y+27);y+=38;
  doc.setFontSize(7);doc.text("x ___________________________________",m,y+8);doc.text("OWNER / AGENT",m+20,y+16);y+=22;
  const bh3=26;doc.setFontSize(18);doc.setFont("helvetica","bold");doc.setTextColor(...dk);doc.text("No. "+(job.id||"").slice(-6).toUpperCase(),m+4,y+18);
  const tw3=pw*.42,tx=m+pw-tw3;doc.setFillColor(...dk);doc.rect(tx,y,tw3*.55,bh3,"F");doc.setTextColor(...wt);doc.setFontSize(14);doc.text("TOTAL",tx+tw3*.275,y+18,{align:"center"});
  doc.setTextColor(...dk);doc.rect(tx+tw3*.55,y,tw3*.45,bh3);if(tot>0){doc.setFontSize(15);doc.setFont("helvetica","bold");doc.setTextColor(...bl);doc.text(tot.toFixed(2),tx+tw3-6,y+18,{align:"right"})}
  y+=bh3+3;doc.setTextColor(...dk);doc.setFontSize(7);doc.setFont("helvetica","normal");doc.text("Thank You For Your Business",w-m,y+6,{align:"right"});
  doc.save("UnitedTowing_"+(job.customer?.name||"job").replace(/[^a-zA-Z0-9]/g,"_").slice(0,20)+"_"+(job.jobDate||"").replace(/-/g,"")+".pdf");
}
