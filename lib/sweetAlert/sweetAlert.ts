import Swal from 'sweetalert2';
import 'animate.css';
import { Messages } from '../config';

const COLORS = {
  cream1: '#f5efe6',
  cream2: '#efe6d6',
  ink: '#1e1f22',
  grayText: '#3a3c40',
  gold: '#d4af37',
  greenA: '#0e5a43',
  greenB: '#0a5c3e',
};

const luxeSwal = Swal.mixin({
  customClass: {
    popup: 'swal-luxe',
    title: 'swal-luxe-title',
    htmlContainer: 'swal-luxe-text',
    confirmButton: 'swal-luxe-confirm',
    cancelButton: 'swal-luxe-cancel',
    icon: 'swal-luxe-icon',
  },
  buttonsStyling: false,
  backdrop: 'rgba(0,0,0,.35)',
  showClass: { popup: 'animate__animated animate__fadeInDown' },
  hideClass: { popup: 'animate__animated animate__fadeOutUp' },
});

/** Toast variant */
const luxeToast = Swal.mixin({
  toast: true,
  position: 'top-end',
  customClass: {
    popup: 'swal-luxe-toast',
    title: 'swal-luxe-toast-title',
    htmlContainer: 'swal-luxe-toast-text',
  },
  showConfirmButton: false,
  timerProgressBar: true,
  backdrop: false,
  showClass: { popup: 'animate__animated animate__fadeInRight' },
  hideClass: { popup: 'animate__animated animate__fadeOutRight' },
});

export const sweetErrorHandling = async (err: any) => {
  const text = err?.message ?? Messages?.error1 ?? 'Something went wrong';
  await luxeSwal.fire({
    icon: 'error',
    title: 'Error',
    text,
  });
};

export const sweetTopSuccessAlert = async (msg: string, duration = 2000) => {
  await luxeSwal.fire({
    icon: 'success',
    title: msg.replace('Definer: ', ''),
    showConfirmButton: false,
    timer: duration,
  });
};

export const sweetContactAlert = async (msg: string, duration = 10000) => {
  await luxeSwal.fire({
    title: msg,
    showConfirmButton: false,
    timer: duration,
    showClass: { popup: 'animate__animated animate__bounceIn' },
  });
};

export const sweetConfirmAlert = (msg: string) => {
  return new Promise<boolean>(async (resolve) => {
    const res = await luxeSwal.fire({
      icon: 'question',
      title: 'Are you sure?',
      text: msg,
      showCancelButton: true,
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel',
    });
    resolve(Boolean(res?.isConfirmed));
  });
};

export const sweetLoginConfirmAlert = (msg: string) => {
  return new Promise<boolean>(async (resolve) => {
    const res = await luxeSwal.fire({
      icon: 'info',
      title: 'Login required',
      text: msg,
      showCancelButton: true,
      confirmButtonText: 'Login',
      cancelButtonText: 'Cancel',
    });
    resolve(Boolean(res?.isConfirmed));
  });
};

export const sweetErrorAlert = async (msg: string, duration = 3000) => {
  await luxeSwal.fire({
    icon: 'error',
    title: msg,
    showConfirmButton: false,
    timer: duration,
  });
};

export const sweetMixinErrorAlert = async (msg: string, duration = 3000) => {
  await luxeSwal.fire({
    icon: 'error',
    title: msg,
    showConfirmButton: false,
    timer: duration,
  });
};

export const sweetMixinSuccessAlert = async (msg: string, duration = 2000) => {
  await luxeSwal.fire({
    icon: 'success',
    title: msg,
    showConfirmButton: false,
    timer: duration,
  });
};

export const sweetBasicAlert = async (text: string) => {
  await luxeSwal.fire({ title: text });
};

export const sweetErrorHandlingForAdmin = async (err: any) => {
  const errorMessage = err?.message ?? Messages?.error1 ?? 'Unexpected error';
  await luxeSwal.fire({
    icon: 'error',
    title: 'Admin',
    text: errorMessage,
  });
};

export const sweetTopSmallSuccessAlert = async (
  msg: string,
  duration = 2000,
  enable_forward = false
) => {
  const res = await luxeToast.fire({ icon: 'success', title: msg, timer: duration });
  if (enable_forward) window.location.reload();
};
