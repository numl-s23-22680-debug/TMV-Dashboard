import fs from 'node:fs/promises';
import { browser, base, createFixturePage, repositoryRoot } from './capture.mjs';
const results=[];
for(const section of ['overview','jobs','drivers','driverreport&driver=DEMO&reportTab=summary&from=2026-10-05&to=2026-10-11','driverreport&driver=DEMO&reportTab=road&from=2026-10-05&to=2026-10-11','van','liabilities&liabilityTab=checkin','notifications','livefleet','configurations']){
 const {context,page}=await createFixturePage();await page.goto(base+'/admin?section='+section,{waitUntil:'networkidle'});page.setDefaultTimeout(10000);
 if(section.startsWith('driverreport'))await page.getByRole('tab',{name:section.includes('reportTab=road')?'Road charges':'Summary',exact:true}).waitFor();
 else if(section==='configurations')await page.getByRole('spinbutton',{name:'1-person crew',exact:false}).waitFor();
 else if(section==='jobs')await page.getByRole('button',{name:/^Open job DEMO-/}).first().waitFor();
 else if(section==='drivers')await page.getByRole('button',{name:/View profile for/}).first().waitFor();
 else if(section==='van')await page.getByRole('button',{name:/View vehicle/}).first().waitFor();
 else if(section.startsWith('liabilities'))await page.getByRole('button',{name:/View evidence for/}).first().waitFor();
 else if(section==='notifications')await page.getByText('Message delivery failed',{exact:true}).waitFor();
 else if(section==='livefleet')await page.getByText('Current job: DEMO-005',{exact:false}).waitFor();
 else if(section==='overview')await page.getByRole('heading',{name:'Daily billed revenue'}).waitFor();
 await page.waitForTimeout(150);

 const colors=await page.evaluate(()=>{
  const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
  const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  return [...document.querySelectorAll('h1,h2,h3,p,span,a,button,td,th,label,summary,small,time,select,text')].flatMap(el=>{
   const rect=el.getBoundingClientRect(),ownText=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();if(!rect.width||!rect.height||!ownText||el.closest('[disabled],[aria-disabled="true"]'))return [];
   const style=getComputedStyle(el),fg=rgb(el.tagName.toLowerCase()==='text'?style.fill:style.color);let bg=[255,255,255];const ancestors=[];for(let node=el;node;node=node.parentElement)ancestors.unshift(node);for(const node of ancestors){const c=rgb(getComputedStyle(node).backgroundColor);if(c.length>=3){const a=c[3]??1;bg=c.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a));}}
   const l1=luminance(fg),l2=luminance(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);const fontSize=parseFloat(style.fontSize),fontWeight=Number(style.fontWeight),required=fontSize>=24||(fontWeight>=700&&fontSize>=18.66)?3:4.5;
   return [{text:ownText.slice(0,90),ratio:Math.round(ratio*100)/100,required,fg:style.color,bg:bg.map(Math.round),fontSize,fontWeight,selector:el.tagName.toLowerCase()+'.'+el.className}];
  });
 });
 const failures=colors.filter(r=>r.ratio+0.01<r.required);results.push({section,checked:colors.length,minimum:Math.min(...colors.map(r=>r.ratio)),failures});console.log(section+': '+colors.length+' text runs; '+failures.length+' below WCAG AA contrast');await context.close();
}
await fs.mkdir(repositoryRoot+'/docs/screenshots/after',{recursive:true});await fs.writeFile(repositoryRoot+'/docs/screenshots/after/contrast-results.json',JSON.stringify({method:'Computed foreground and composited ancestor backgrounds; visible text runs excluding disabled controls; WCAG AA 4.5:1 normal, 3:1 large text',results},null,2));await browser.close();
