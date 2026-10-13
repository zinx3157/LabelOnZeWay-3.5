export function deleteManifestParcels(state, ids, now = new Date().toISOString()) {
  const selected = new Set(ids);
  const removed = state.parcels.filter(parcel => selected.has(parcel.id));
  if (!removed.length) return state;
  return {
    ...state,
    parcels: state.parcels.filter(parcel => !selected.has(parcel.id)),
    archive: [...state.archive.filter(parcel => !removed.some(item => item.id === parcel.id)), ...removed.map(parcel => ({...parcel, archivedAt: now, deletedFromManifest: true, deletedAt: now, modifiedAt: now}))],
    ui: {...state.ui, notice: `${removed.length} parcel${removed.length === 1 ? '' : 's'} deleted from manifest. Restore from Archive if needed.`},
  };
}
export function restoreArchivedParcel(parcel, now = new Date().toISOString()) {
  const {deletedFromManifest,deletedAt,archivedAt,...restored}=parcel;
  return {...restored,status:deletedFromManifest ? parcel.status : parcel.status === 'delivered' ? 'delivery' : parcel.status,modifiedAt:now};
}
