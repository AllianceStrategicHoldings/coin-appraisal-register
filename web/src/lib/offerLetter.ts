// Client-side offer letter PDF (SOW 2.6 / Section 4).
// Generated at acceptance with deal terms, offer amount, customer info, and
// the customer's signature embedded inline above the signature line. The
// blob uploads to cloud storage; the URL lands on the deal record.

import { jsPDF } from 'jspdf'
import type { CartLine, Margin, Spot } from '../api/types'
import { dualPriceLine } from './pricing'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface OfferLetterInput {
  customerName: string
  dlNumber: string
  dealDraftId: string
  lines: CartLine[]
  spot: Spot | null
  margins: Margin[]
  totalOffer: number
  paymentMethod: string
  /** PNG data URL from the signature pad */
  signatureDataUrl: string
  signedAt: Date
}

export function buildOfferLetterPdf(input: OfferLetterInput): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const left = 20
  const right = pageW - 20
  let y = 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Offer Letter', left, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(
    input.signedAt.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),
    right,
    y,
    { align: 'right' },
  )
  y += 4
  doc.setDrawColor(180)
  doc.line(left, y, right, y)
  y += 10

  doc.setTextColor(0)
  doc.setFontSize(11)
  doc.text(`Customer: ${input.customerName}`, left, y)
  y += 6
  doc.text(`ID (DL #): ${input.dlNumber}`, left, y)
  y += 6
  doc.text(`Reference: ${input.dealDraftId}`, left, y)
  y += 6
  doc.text(`Payment method: ${input.paymentMethod}`, left, y)
  y += 12

  doc.setFont('helvetica', 'bold')
  doc.text('Items', left, y)
  doc.text('Offer', right, y, { align: 'right' })
  y += 2
  doc.line(left, y, right, y)
  y += 6
  doc.setFont('helvetica', 'normal')

  for (const line of input.lines) {
    const dual = dualPriceLine(line, input.spot, input.margins)
    const qty =
      line.priced_by === 'weight_grams'
        ? `${line.weight_grams} ${line.unit_label}`
        : `${line.quantity} ${line.unit_label}`
    doc.text(`${line.name} — ${qty}`, left, y, { maxWidth: right - left - 30 })
    doc.text(dual ? usd.format(dual.actualOffer) : '—', right, y, { align: 'right' })
    y += 6
    if (y > 240) {
      doc.addPage()
      y = 24
    }
  }

  y += 2
  doc.setDrawColor(0)
  doc.line(left, y, right, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Total offer', left, y)
  doc.text(usd.format(input.totalOffer), right, y, { align: 'right' })
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  const terms =
    'The customer named above agrees to sell the listed items for the total ' +
    'offer shown, payable by the payment method stated. The customer affirms ' +
    'they are the lawful owner of the items, are 18 years of age or older, ' +
    'and accept this offer as full and final payment.'
  const termsLines = doc.splitTextToSize(terms, right - left)
  doc.text(termsLines, left, y)
  y += termsLines.length * 4.5 + 12

  // Signature embedded inline above the signature line (Section 4).
  doc.setTextColor(0)
  doc.setFontSize(11)
  try {
    doc.addImage(input.signatureDataUrl, 'PNG', left, y, 70, 26)
  } catch {
    // If the PNG can't be embedded the letter still generates; the signature
    // PNG itself is stored separately in cloud storage.
  }
  y += 28
  doc.line(left, y, left + 80, y)
  y += 5
  doc.setFontSize(9)
  doc.text(`Customer signature — ${input.customerName}`, left, y)
  doc.text(
    `Signed ${input.signedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
    left,
    y + 5,
  )

  return doc.output('blob')
}
