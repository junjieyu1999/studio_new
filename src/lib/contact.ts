// Single source of truth for contact details used by the floating ContactWidget.
// Edit these values to update contact info everywhere.
export const CONTACT = {
  email: "yujunjiestudio@gmail.com",
  instagramHandle: "junjieyu.studio",
};

export const instagramUrl = `https://instagram.com/${CONTACT.instagramHandle}`;
export const emailUrl = `mailto:${CONTACT.email}`;

// Pre-filled email for enquiring about a specific piece.
export function inquiryMailto(title: string): string {
  const subject = encodeURIComponent(`Enquiry: ${title}`);
  const body = encodeURIComponent(
    `Hi Jun Jie,\n\nI'm interested in "${title}". Could you let me know about availability and price?\n\nThank you!`
  );
  return `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
}

// Pre-filled email for a commission request.
export function commissionMailto(): string {
  const subject = encodeURIComponent("Commission enquiry");
  const body = encodeURIComponent(
    `Hi Jun Jie,\n\nI'd love to commission a piece. Here's what I have in mind:\n\n- Subject / idea:\n- Portrait or landscape:\n- Approx. size:\n- Budget:\n- Timeline:\n\nThank you!`
  );
  return `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
}
