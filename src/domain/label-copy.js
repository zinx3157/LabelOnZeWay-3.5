export function printedLabelData(parcel) {
  const {labelCopy,...source}=parcel;
  const copy=structuredClone(source);
  if(copy.printZeroAmounts){copy.unitPrice=0;copy.collect=0;copy.deliveryCharge=0;}
  return copy;
}
export function savedLabelData(parcel) { return parcel.labelCopy?.parcel || printedLabelData(parcel); }
