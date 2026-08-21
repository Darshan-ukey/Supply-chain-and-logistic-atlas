import assert from 'node:assert/strict';
import {createReviewItem,listReviewItems,resolveReviewItem} from '../lib/runtime/review.js';
const x=await createReviewItem({type:'TEST',summary:'test review',severity:'LOW'});assert.equal(x.status,'OPEN');let l=await listReviewItems();assert.ok(l.items.some(i=>i.id===x.id));const r=await resolveReviewItem(x.id,'APPROVED');assert.equal(r.status,'APPROVED');console.log('review-smoke: PASS');
