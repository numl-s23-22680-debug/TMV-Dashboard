import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserLaunchOptions } from './browser-launch.mjs';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.env.TMV_BASE_URL || 'http://localhost:3002';
const phase = process.env.TMV_PHASE || 'after';
const outDir = process.env.TMV_SCREENSHOTS || path.join(repositoryRoot, 'docs/screenshots', phase);
const now = '2026-10-13T11:00:00.000Z';
const browser = await chromium.launch(browserLaunchOptions({ bundledPath: chromium.executablePath() }));
const bootstrap = await browser.newContext({ serviceWorkers: 'block' });
const bootpage = await bootstrap.newPage();
await bootpage.route('**/fixture-bootstrap', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Sanitized browser fixture bootstrap</body></html>' }));
await bootpage.goto(base + '/fixture-bootstrap');
const sample = await bootpage.evaluate(async () => {
  const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
  const { sampleDriverReport } = await import('/src/screens/admin/dashboard/fixtures/driverReport.sample.ts');
  return sampleDriverReport('DEMO', { from:'2026-10-05', to:'2026-10-11', pageSize:1000, activityScheme:'all' });
});
await bootstrap.close();
// The uploaded application is used unchanged. Browser data is explicitly
// synthetic before any page can render it or include it in a screenshot/PDF.
sample.driver.name = 'Sample Driver';
sample.driver.email = 'demo@example.test';
sample.driver.currentVehicleImei = 'SAMPLE-DEMO';
for (const [index, job] of sample.jobs.items.entries()) {
 job.customer = { name: `Sample Customer ${index + 1}`, email:'customer@example.test', phone:'Not supplied' };
 job.pickup = 'Sample pickup, Camden, London'; job.dropoff = 'Sample delivery, Islington, London';
 if(job.manualDetails?.helperName)job.manualDetails.helperName = 'Sample Helper';
}
for(const helper of sample.summary.helpers ?? [])helper.name = 'Sample Helper';
for(const trend of sample.trends ?? [])for(const helper of trend.helpers ?? [])helper.name = 'Sample Helper';
for(const liability of sample.liabilities?.items ?? [])liability.description = 'Synthetic evidence record for browser verification';
sample.roadAlerts.items.push({...sample.roadAlerts.items[0],id:'sample-unlinked-road',jobId:null,estimatedPence:null,feeReason:'No job match; fee unavailable',linkBasis:'unlinked'});sample.roadAlerts.total=sample.roadAlerts.items.length;sample.roadAlertSummary.entries+=1;sample.roadAlertSummary.unpricedEntries+=1;

export const settings = [
  ['CREW_RATE_1_MAN','Normal Service — 1 Man (£)','40'], ['CREW_RATE_2_MAN','Normal Service — 2 Man (£)','55'], ['CREW_RATE_3_MAN','Normal Service — 3 Man (£)','65'], ['CREW_BILLING_UNIT','Billing Unit','per 30 min'], ['PACKING_RATE','Packing rate','60'], ['CONGESTION_CHARGE','Congestion charge','18'], ['TUNNEL_CHARGE','Tunnel charge','13.60'], ['OVERTIME_RATE_PER_30','Overtime rate',''], ['OVERTIME_GRACE_MINS','Grace period','5']
].map(([key,label,value]) => ({ key,label,value,type:key==='CREW_BILLING_UNIT'?'text':'number',fallback:value,hint:'' }));
const names = ['Sample Customer One','Sample Customer Two','Sample Customer Three','Sample Customer Four','Sample Customer Five','Sample Customer Six','Sample Customer Seven','Sample Customer Eight'];
const allJobs = sample.jobs.items.map((j,index) => {
  const status = index < 3 ? 'READY' : index < 5 ? 'IN_PROGRESS' : index === 6 ? 'CANCELLED' : 'COMPLETED';
  const initials = index % 3 === 0 ? 'NEXT' : 'DEMO';
  const start = `2026-10-13T${String(7 + index % 10).padStart(2,'0')}:00:00Z`;
  return { jobId:j.jobId, calendarEventId:`sample-event-${index}`, bookedStart:start, bookedFinish:new Date(Date.parse(start)+90*60000).toISOString(), actualStart:status==='COMPLETED'||status==='IN_PROGRESS'?start:undefined, actualFinish:status==='COMPLETED'?new Date(Date.parse(start)+150*60000).toISOString():undefined,
    bookedMinutes:90, allocatedMinutes:120, actualMinutes:status==='COMPLETED'?150:undefined, delayMinutes:index % 3 * 5, delayBand:index%3?'LATE_5_15':'ON_TIME', timingTrustworthy:index%5!==0, arrivalDelaySource:index%5===0?'unavailable':'gps-two-fresh-reports', trackerStatus:index%5===0?'unverified':'reporting', trackerArrivalAt:index%5===0?undefined:start,
    customerName:names[index%8], customerEmail:'sample@example.test', customerPhone:'Not supplied',pickup:'Sample pickup, Camden, London',dropoff:'Sample delivery, Islington, London',crewSize:2,
    driverInitials:initials,driverName:initials==='DEMO'?'Sample Driver':'Second Sample Driver',driverEmail:initials.toLowerCase()+'@example.test',status,currentState:status==='COMPLETED'?'FINISHED':status==='IN_PROGRESS'?'ARRIVED':'READY',workflowCompletionPct:status==='COMPLETED'?100:status==='IN_PROGRESS'?40:0,
    basePrice:20000,extraChargeSelections:[],extraCharges:0,congestionCharge:j.finance.congestionPence,tunnelCharge:j.finance.tunnelPence,overtimeMinutes:30,overtimeCharge:5500,calculatedTotalCharges:j.finance.systemCalculatedPence,totalCharges:j.finance.acceptedPence,amountCharged:j.finance.acceptedPence,reconciled:index%4!==0,paymentMethod:j.finance.systemPayments.invoicePence?'Invoice':'Cash/Card',paymentBreakdown:Object.entries(j.finance.systemPayments.byMethod).filter(([,amount])=>amount>0).map(([method,amount])=>({method,amount})),extraChargeBreakdown:[],paymentStatus:j.finance.systemPayments.invoicePence?'UNPAID':'PAID',paidOnline:false,
    driverJobSummary:j.manualDetails?{...j.manualDetails,jobId:j.jobId,driverInitials:initials,driverEmail:initials.toLowerCase()+'@example.test',congestionCharge:!!j.finance.congestionPence,congestionChargePence:j.finance.congestionPence,paymentMethod:'Cash/Card',schemaVersion:2}:undefined,
    evidenceCompleteness:{arrival:status==='READY'?'MISSING':'COMPLETED',vanLoaded:status==='READY'?'MISSING':'COMPLETED',stopBy:'MISSING',emptyVan:status==='COMPLETED'?'COMPLETED':'MISSING',organized:status==='COMPLETED'?'COMPLETED':'MISSING',signature:index%4===0?'MISSING':'COMPLETED'},evidenceItems:[],scenarios:[],rawTitle:'2 men 115£/Y-DEMO',rawDescription:'Sanitized local fixture. Booked service time: 90 minutes.',bookingDetails:{hireDuration:'90 minutes',vanSize:'Luton'},activity:[],exceptions:index%4===0?[{type:'MISSING_SUBMISSION',detail:'Driver submission not recorded',timestamp:start}]:[],created:now,updated:now,managerReviewStatus:index%4===0?'Pending':'Approved',driverViewedAt:status==='READY'?undefined:start,reviewEmailStatus:index%3?'Yes':'No' };
});
const drivers = ['DEMO','NEXT','REST'].map((initials,index) => {
 const own=allJobs.filter(j=>j.driverInitials===initials),finished=own.filter(j=>j.status==='COMPLETED');
 const sum=key=>finished.reduce((n,j)=>n+(j[key]||0),0)/100;
 return {initials,fullName:index===0?'Sample Driver':index===1?'Second Sample Driver':'Driver Without Jobs',email:initials.toLowerCase()+'@example.test',phone:'Not supplied',vanRegistration:index===0?'DEMO 01':index===1?'DEMO 02':'',imei:index===2?'':'SAMPLE-'+initials,active:index<2,hasAccount:true,role:'driver',hasPassword:true,lastLoginAt:now,assigned:own.length,completed:finished.length,cancelled:own.filter(j=>j.status==='CANCELLED').length,completionRate:own.length?finished.length/own.length*100:0,avgDurationMinutes:finished.length?150:0,totalDurationMinutes:finished.length*150,workingUnknownJobs:0,movingKnownSeconds:finished.length*3600,movingUnknownJobs:0,movingPartialJobs:2,avgDelayMinutes:index===0?-3:index===1?6:0,totalChargesPounds:sum('amountCharged'),calculatedChargesPounds:sum('calculatedTotalCharges'),revenuePounds:sum('amountCharged'),revenueFormatted:'',cashCollectedPounds:finished.reduce((n,j)=>n+j.paymentBreakdown.filter(p=>p.method==='Cash').reduce((a,p)=>a+p.amount,0),0)/100,cardCollectedPounds:sum('amountCharged')*.4,bankCollectedPounds:0,invoiceCollectedPounds:0,invoiceUncollectedPounds:finished.reduce((n,j)=>n+j.paymentBreakdown.filter(p=>p.method==='Invoice').reduce((a,p)=>a+p.amount,0),0)/100,totalCollectionsPounds:finished.reduce((n,j)=>n+j.paymentBreakdown.filter(p=>p.method!=='Invoice').reduce((a,p)=>a+p.amount,0),0)/100,unknownCollectionJobs:0,congestionChargePounds:sum('congestionCharge'),tunnelChargePounds:sum('tunnelCharge'),overtimeMinutes:finished.length*30,missingEvidenceCount:finished.filter(j=>j.evidenceCompleteness.signature==='MISSING').length,overtimeCount:finished.length,reviewSentCount:finished.filter(j=>j.reviewEmailStatus==='Yes').length,reviewNotSentCount:finished.filter(j=>j.reviewEmailStatus!=='Yes').length};
});
const pagination = (items,q) => {const page=Number(q.get('page')||1),pageSize=Number(q.get('pageSize')||q.get('limit')||25),total=items.length,totalPages=Math.ceil(total/pageSize);return {items:items.slice((page-1)*pageSize,page*pageSize),pagination:{page,pageSize,total,totalPages,hasMore:page<totalPages},meta:{fetchedAt:now,durationMs:14}};};
const vanItems=drivers.slice(0,2).map((d,index)=>({id:'van-'+index,driverName:d.fullName,driverEmail:d.email,driverInitials:d.initials,vanRegistration:d.vanRegistration,latestSubmittedAt:now,latestMileage:null,latestFuel:{id:'fuel-'+index,type:'FUEL',submittedAt:now,driverName:d.fullName,driverEmail:d.email,driverInitials:d.initials,vanRegistration:d.vanRegistration,odometerReading:56000+index*10000,fuelCost:72.50,photoUrl:'',thumbUrl:''},latestService:null,compliance:{vanRegistration:d.vanRegistration,roadTaxRenewalDate:index?'2027-10-01':'2026-10-10',motExpiryDate:index?'2027-04-01':'2026-10-22',insuranceExpiryDate:'2027-03-01',serviceIntervalMiles:8000,lastServiceMileage:49000,currentMileage:56000,notes:'Sanitized local vehicle'},records:[]}));
const summary = {kpis:{totalJobs:allJobs.length,scheduled:allJobs.filter(j=>j.status==='READY').length,inProgress:allJobs.filter(j=>j.status==='IN_PROGRESS').length,completed:allJobs.filter(j=>j.status==='COMPLETED').length,cancelled:1,late:allJobs.filter(j=>j.delayMinutes>0).length,incomplete:allJobs.filter(j=>j.evidenceCompleteness.signature==='MISSING').length,revenuePounds:allJobs.reduce((n,j)=>n+j.amountCharged,0)/100,revenueFormatted:'',cashCollectedPounds:drivers.reduce((n,d)=>n+d.cashCollectedPounds,0),cardBankPounds:drivers.reduce((n,d)=>n+d.cardCollectedPounds,0),extraChargesPounds:0,overtimePounds:allJobs.reduce((n,j)=>n+j.overtimeCharge,0)/100,photosMissing:9,photosProcessing:0,photosFailed:0,missingSignatures:9,driversWorkingCount:2,avgDurationMinutes:150,avgDelayMinutes:5},charts:{statusBreakdown:['READY','IN_PROGRESS','COMPLETED','CANCELLED'].map((status,index)=>({label:status,value:allJobs.filter(j=>j.status===status).length,color:['#1B75BC','#F59E0B','#16A34A','#94A3B8'][index]})),revenueOverTime:sample.trends.map(t=>({date:t.period,revenuePounds:t.expectedKnownPence/100,jobsCount:t.completedJobs})),paymentMethodSplit:Object.entries(sample.summary.systemPaymentsByMethodPence).map(([method,amount])=>({method,totalPounds:amount/100,count:sample.jobs.total})),jobsByDriver:drivers.map(d=>({driverName:d.fullName,initials:d.initials,completed:d.completed,active:d.assigned-d.completed-d.cancelled}))},meta:{fetchedAt:now,durationMs:14}};
const evidenceRecords = [0,1].map(index=>({id:'sample-evidence-'+index,jobId:allJobs[index].jobId,clientName:allJobs[index].customerName,driverName:allJobs[index].driverName,driverInitials:allJobs[index].driverInitials,driver:allJobs[index].driverName,timestamp:'2026-10-13T09:15:00Z',address:'Sample loading location, Camden, London',containerNumber:'',photos:[],signature:null,rawRecord:{'Job ID':allJobs[index].jobId,'Client Name':allJobs[index].customerName,'Driver':allJobs[index].driverName,'Timestamp':'2026-10-13T09:15:00Z','Client Present':'Yes','Address':'Sample loading location, Camden, London','Damage Categories':'Packing condition recorded'}}));
const syntheticPhoto = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#eef2ff"/><rect x="80" y="70" width="480" height="180" fill="#c4b5fd"/><text x="320" y="305" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#1f2937">Synthetic evidence photo</text></svg>').toString('base64');
evidenceRecords[0].photos = [1,2].map(index=>({fileId:`synthetic-photo-${index}`,thumbUrl:syntheticPhoto,fileUrl:syntheticPhoto,capturedAt:now}));
for(const record of evidenceRecords)record.rawRecord['Driver Name'] = record.driverName;
const messages=[{id:'on-the-way-customer-sms',audience:'customer',channel:'SMS',label:'Driver on the way',hint:'Sent when the assigned driver selects On my way',variables:['{customerName}','{driver_name}','{jobId}'],enabled:true,hasTitle:false,hasHtml:false,body:'Hi {customerName}, {driver_name} is on the way for your move.',bodyFallback:''},{id:'driver-new-job-push',audience:'driver',channel:'Push',label:'New job assigned',hint:'Sent after a new assignment',variables:['{driver_name}','{jobId}'],enabled:true,hasTitle:true,hasHtml:false,title:'New job',body:'{driver_name}, job {jobId} has been assigned.',bodyFallback:''}];
const alerts=[{eventId:'sample-alert-1',type:'tracker_stale',description:'Tracker last seen over 30 minutes ago',category:'other',deviceName:'DEMO 02',driverInitials:'NEXT',driverName:'Second Sample Driver',detectedAt:now}];
const notificationRows=[{jobId:allJobs[3].jobId,customerName:allJobs[3].customerName,customerEmail:'sample@example.test',customerPhone:'Not supplied',driverInitials:'DEMO',actualStart:now,email:{state:'sent',detail:'Accepted by provider',at:now},sms:{state:'failed',detail:'Synthetic delivery failure',at:now}}];
const fleet=drivers.slice(0,2).map((d,index)=>({imei:d.imei,name:d.vanRegistration,plateNumber:d.vanRegistration,lat:51.54+index*.012,lng:-.14+index*.022,speedMph:index?0:18,lastUpdate:index?'2026-10-13 09:30:00':'2026-10-13 10:59:30',driverInitials:d.initials,driverName:d.fullName,odometerMiles:56000,ignitionOn:index===0,batteryVoltage:12.8,gpsSignalLevel:4,gsmSignalLevel:4,jammingDetected:false,ecoDrivingEvent:null,ecoDrivingScore:null}));

export const errors=[],mutations=[],unhandled=[];
export const fixtureControl={ failSettings:new Set(), errorPaths:new Set(), emptyPaths:new Set(), allJobs, sample, settings, syntheticPhoto };
export { browser, base };
export async function apiFixture(route) {
 const req=route.request(),url=new URL(req.url()),p=url.pathname,q=url.searchParams;
 if(fixtureControl.errorPaths.has(p))return route.fulfill({status:503,json:{error:{message:'Synthetic API outage'}}});
 if(fixtureControl.emptyPaths.has(p))return route.fulfill({json: p.includes('/scenarios/')?{kind:p.split('/').at(-1),...pagination([],q)}:pagination([],q)});
 if(req.method()!=='GET') {mutations.push({method:req.method(),path:p,body:req.postData()});if(p==='/api/admin/settings'){const v=req.postDataJSON();if(fixtureControl.failSettings.has(v.key))return route.fulfill({status:503,json:{error:{message:'Synthetic setting failure'}}});settings.find(s=>s.key===v.key).value=v.value;return route.fulfill({json:{ok:true}});}return route.fulfill({status:405,json:{error:{message:'Mutation disabled in sanitized browser harness'}}});}
 let body;
 if(p==='/api/admin/me')body={email:'admin@example.test'};
 else if(p==='/api/admin/settings')body={settings};
 else if(p==='/api/admin/drivers')body={drivers};
 else if(p==='/api/admin/drivers/summary')body={drivers};
 else if(p==='/api/admin/summary')body=summary;
 else if(p==='/api/admin/messages')body={items:messages};
 else if(p==='/api/admin/notifications')body={rows:notificationRows};
 else if(p==='/api/admin/alerts')body={rows:alerts};
 else if(p==='/api/admin/fleet/live')body={vehicles:fleet,fetchedAt:now};
 else if(p==='/api/admin/fleet/congestion')body={rows:[]};
 else if(p==='/api/admin/fleet/congestion-zones')body={zones:[]};
 else if(p==='/api/admin/van/drivers')body=pagination(vanItems,q);
 else if(p==='/api/admin/van/records')body=pagination(vanItems.flatMap(v=>v.records),q);
 else if(p.startsWith('/api/admin/scenarios/'))body={kind:p.split('/').at(-1),...pagination(evidenceRecords,q)};
 else if(p.startsWith('/api/admin/liabilities/jobs/'))body={items:[],coverage:'complete'};
 else if(p.startsWith('/api/admin/gps/jobs/'))body={flags:[],comparisons:[],activity:[]};
 else if(p==='/api/admin/jobs') {let rows=allJobs;if(q.has('status'))rows=rows.filter(j=>j.status===q.get('status'));if(q.has('driver'))rows=rows.filter(j=>j.driverInitials===q.get('driver'));if(q.has('q'))rows=rows.filter(j=>`${j.customerName} ${j.jobId} ${j.pickup} ${j.dropoff}`.toLowerCase().includes(q.get('q').toLowerCase()));if(q.has('sort'))rows=[...rows].sort((a,b)=>a[q.get('sort')]>b[q.get('sort')]?1:-1);if(q.get('dir')==='desc')rows.reverse();body=pagination(rows,q);}
 else if(p.startsWith('/api/admin/jobs/')&&!p.endsWith('.csv'))body={job:allJobs.find(j=>j.jobId===decodeURIComponent(p.split('/').at(-1)))||allJobs[0]};
 else if(p.startsWith('/api/admin/driver-reports/')) {body=structuredClone(sample);body.driver.initials=decodeURIComponent(p.split('/').at(-1));body.driver.name=drivers.find(d=>d.initials===body.driver.initials)?.fullName||'Sample Driver';for(const key of ['jobs','roadAlerts','events','visits','charges','liabilities']){const page=Number(q.get(key+'Page')||1),pageSize=Number(q.get('pageSize')||25);let rows=body[key].items;if((key==='roadAlerts'||key==='charges')&&q.get('activityScheme')&&q.get('activityScheme')!=='all')rows=rows.filter(r=>q.get('activityScheme')==='congestion'?r.type==='congestion':r.type==='tunnel');body[key]={items:rows.slice((page-1)*pageSize,page*pageSize),total:rows.length,page,pageSize};}body.meta.gpsIncluded=q.get('detail')!=='core';body.meta.liabilitiesIncluded=true;}
 else if(p.startsWith('/api/push/'))body={publicKey:''};
 else {unhandled.push(p);return route.fulfill({status:404,json:{error:{message:'No sanitized fixture for '+p}}});}
 await route.fulfill({json:body});
}
export async function createFixturePage(width=1366,height=1000,origin=base) {
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block',locale:'en-GB',timezoneId:'Europe/London'});
 await context.addInitScript(()=>{localStorage.setItem('tmv:lf-collapse-hint','1');Object.defineProperty(window.Notification,'permission',{get:()=> 'denied'});});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/'))return apiFixture(route);if(url.origin!==new URL(origin).origin)return route.abort();return route.continue();});
 const page=await context.newPage();await page.clock.install({time:new Date(now)});page.on('pageerror',err=>errors.push(err.message));return {context,page};
}
if(process.argv[1] === fileURLToPath(import.meta.url)) {
await fs.mkdir(outDir,{recursive:true});
const views=[['overview','section=overview'],['jobs','section=jobs'],['drivers','section=drivers'],['driver-report','section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=jobs'],['payments','section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=payments'],['vehicles','section=van'],['evidence','section=liabilities&liabilityTab=checkin'],['alerts','section=notifications'],['settings','section=configurations'],['live-fleet','section=livefleet'],['summary',`section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=${phase==='before'?'performance':'summary'}`],['road-charges',`section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=${phase==='before'?'tunnels':'road'}`],['job-detail','section=jobs&job=DEMO-009'],['driver-performance','section=drivers&driversTab=performance'],['driver-profile','section=drivers'],['vehicle-detail','section=van'],['message-templates','section=configurations&configurationTab=messaging'],['reconciliation','section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=comparison'],['delivery-log','section=notifications&notificationsTab=notifications']];
const readPageState=()=>({title:document.title,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,headings:[...document.querySelectorAll('h1,h2,h3')].map(n=>n.textContent),text:document.body.innerText.slice(0,1200)});
async function pageState(page){for(let attempt=0;attempt<3;attempt++){try{return await page.evaluate(readPageState);}catch(error){if(attempt===2||!/context was destroyed|navigation/i.test(error.message))throw error;await page.waitForLoadState('networkidle');await page.waitForTimeout(500);}}}
const selected=(process.env.TMV_VIEWS||'').split(',').filter(Boolean);
const widths=(process.env.TMV_WIDTHS||'1366,390').split(',').map(Number);
const results=[];
for(const width of widths){for(const [name,query]of views){if(selected.length&&!selected.includes(name))continue;const {context,page}=await createFixturePage(width,width<500?844:1000);await page.goto(`${base}/admin?${query}`,{waitUntil:'networkidle'});await page.waitForTimeout(800);if(name==='overview'&&phase==='before'){const switcher=page.getByRole('radio',{name:'Overview',exact:true});if(await switcher.count())await switcher.click();await page.waitForTimeout(600);}if(name==='vehicle-detail'){await page.getByRole('button',{name:/View vehicle/}).first().click();await page.waitForTimeout(250);}if(name==='driver-profile'){await page.getByRole('button',{name:/View profile/}).first().click();await page.waitForTimeout(250);}const state=await pageState(page);await page.screenshot({path:path.join(outDir,`${name}-${width}.png`),fullPage:true});await page.screenshot({path:path.join(outDir,`${name}-${width}-viewport.png`),fullPage:false});results.push({name,width,...state});console.log(`${phase}: ${name} ${width}px (${state.scrollWidth===state.clientWidth?'no page overflow':'OVERFLOW '+state.scrollWidth})`);await context.close();}}
let old=[];if(selected.length){try{old=JSON.parse(await fs.readFile(path.join(outDir,'capture-results.json'),'utf8')).results.filter(r=>!results.some(n=>n.name===r.name&&n.width===r.width));}catch{}}
await fs.writeFile(path.join(outDir,'capture-results.json'),JSON.stringify({base,phase,sanitizedFixture:true,results:[...old,...results],errors,mutations,unhandled},null,2));
await browser.close();
}
