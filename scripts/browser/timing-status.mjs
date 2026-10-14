import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { browser,base,createFixturePage,fixtureControl,errors,repositoryRoot } from './capture.mjs';
const original=structuredClone(fixtureControl.sample.jobs.items[0]);
const row=fixtureControl.sample.jobs.items[0];
row.finance.manualPayments=structuredClone(row.finance.systemPayments);
row.finance.paymentMethodDifferences=[];row.roadCharges.flags=[];
row.manualDetails.startTime=row.actualStart;row.manualDetails.endTime=row.actualFinish;
row.manualDetails.amountCollectedPence=row.finance.systemPayments.collectedPence;
row.duration.manualMinutes=row.duration.workingMinutes;row.duration.differenceMinutes=0;
const out=repositoryRoot+'/docs/screenshots/after';
const {context,page}=await createFixturePage(390,844);page.setDefaultTimeout(10000);
const query='section=driverreport&driver=DEMO&from=2026-10-05&to=2026-10-11&reportTab=comparison&comparisonFilter=all';
const results=[];
try{
 await page.goto(base+'/admin?'+query,{waitUntil:'networkidle'});
 const jobRow=page.getByRole('table',{name:'Receipt reconciliation'}).locator('tbody tr').filter({hasText:'DEMO-001'});
 const match=jobRow.getByText('Receipt & timing match',{exact:true});await match.waitFor();
 const measure=await match.evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,width:el.getBoundingClientRect().width}));
 assert.ok(measure.scrollWidth<=measure.clientWidth);assert.ok(measure.width<390);
 await match.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/timing-match-mobile-viewport.png'});
 results.push({name:'Verified receipt and timing match has a readable mobile label',passed:true});
 row.duration.workingMinutes=null;row.duration.differenceMinutes=null;row.actualFinish=null;
 await page.reload({waitUntil:'networkidle'});await jobRow.getByText('Needs verification',{exact:true}).waitFor();
 assert.equal(await jobRow.getByText('Receipt & timing match',{exact:true}).count(),0);
 await jobRow.getByText('Needs verification',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/timing-unverified-mobile-viewport.png'});
 results.push({name:'Missing timing operands remain Needs verification even when receipts match',passed:true});
 assert.equal(errors.length,0);console.log('PASS readable mobile match label');console.log('PASS missing timing evidence remains Needs verification');
}catch(error){results.push({name:'Timing status browser check',passed:false,error:error.message});process.exitCode=1;}
finally{fixtureControl.sample.jobs.items[0]=original;await fs.writeFile(out+'/timing-status-results.json',JSON.stringify({sanitizedFixture:true,results,runtimeErrors:errors},null,2));await context.close();await browser.close();}
