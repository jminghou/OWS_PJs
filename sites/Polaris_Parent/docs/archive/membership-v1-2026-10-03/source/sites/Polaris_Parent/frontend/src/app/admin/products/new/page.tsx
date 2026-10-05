import { redirect } from 'next/navigation';

export default function NewProductRedirect() {
  redirect('/admin/products');
}
