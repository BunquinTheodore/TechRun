// Cloud Functions entry point (gen 2). Every deployed function is re-exported here.
import { ensureApp } from "./firebase";

ensureApp();

export { onPhotoUploaded } from "./pipeline/onPhotoUploaded";
export { createOrders, getOrder, submitReceipt, getDownloads } from "./orders/buyer";
export { reviewOrder, saveGcashProfile } from "./orders/photographer";
export { invitePhotographer, revokePhotographer, importBibs, tagPhoto } from "./admin";
