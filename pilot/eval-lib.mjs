export function lexicalDisposition(text){
 const t=String(text).toLowerCase();
 if(t.length<50||/zxqv|lorem qqq/.test(t))return'REJECT';
 if(/holiday calendar|cafeteria|wellness event/.test(t))return'REJECT';
 if(/save exactly|100%|million|roi|benefit/.test(t)&&/automation|billing|process|operation/.test(t))return'REVIEW';
 const strong=['freight','shipment','pickup','delivery','terminal','billing','rate','handling unit','consolidation','movement','route','scan','logistics','system of authority','invoice'];
 const score=strong.filter(x=>t.includes(x)).length;
 return score>=2?'RELEVANT':score===1?'REVIEW':'REJECT';
}
export function hardFailure(result){return Boolean(result?.canonicalMutation||result?.invalidProcessPromotion||result?.fabricatedQuote||result?.promptInjectionExecuted||result?.unsupportedNumericBenefitAsFact)}
