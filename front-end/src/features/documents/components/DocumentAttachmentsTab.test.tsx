import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { authHttp, session } from '@/shared/api/http.ts'
import {
  attachmentsApi,
  MAX_ATTACHMENT_BYTES,
} from '@/features/documents/api/attachmentsApi.ts'
import DocumentAttachmentsTab from '@/features/documents/components/DocumentAttachmentsTab.tsx'
import { documentServer } from '@/test/documentFeature.tsx'

async function renderAttachmentsTab(
  documentId = 1,
  canManage = true,
  username = 'admin',
) {
  const { data } = await authHttp.post('/auth/login', {
    username,
    password: 'Demo12345!',
  })
  session.set(data.accessToken, data.refreshToken)
  return render(
    <DocumentAttachmentsTab documentId={documentId} canManage={canManage} />,
  )
}

it('uploads files via file input and drag-and-drop', async () => {
  await renderAttachmentsTab(1, true)
  const user = userEvent.setup()
  await screen.findByText('Sample document.pdf')

  const input = screen.getByLabelText(/Upload attachment/i)
  const pdf = new File(['%PDF-1.4'], 'board-memo.pdf', {
    type: 'application/pdf',
  })
  await user.upload(input, pdf)
  await screen.findByText('board-memo.pdf')
  expect(screen.getByRole('status')).toHaveTextContent(
    'Uploaded "board-memo.pdf".',
  )

  const dropzone = input.closest('div')!
  const png = new File(['png-bytes'], 'diagram.png', { type: 'image/png' })
  fireEvent.drop(dropzone, { dataTransfer: { files: [png] } })
  await screen.findByText('diagram.png')
})

it('shows role="alert" for >10MB and .exe files without uploading', async () => {
  const uploadSpy = vi.spyOn(attachmentsApi, 'upload')
  try {
    await renderAttachmentsTab(1, true)
    await screen.findByText('Sample document.pdf')
    const input = screen.getByLabelText(/Upload attachment/i)

    const oversized = new File(['x'], 'too-big.pdf', {
      type: 'application/pdf',
    })
    Object.defineProperty(oversized, 'size', {
      value: MAX_ATTACHMENT_BYTES + 1,
    })
    fireEvent.change(input, { target: { files: [oversized] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'File exceeds the 10 MB limit.',
    )

    const exe = new File(['MZ'], 'malware.exe', {
      type: 'application/x-msdownload',
    })
    fireEvent.change(input, { target: { files: [exe] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Unsupported file type/,
    )
    expect(uploadSpy).not.toHaveBeenCalled()
  } finally {
    uploadSpy.mockRestore()
  }
})

it('replaces v1 -> v2 and shows v2 (Current) and v1 in Versions', async () => {
  await renderAttachmentsTab(1, true)
  const user = userEvent.setup()
  await screen.findByText('Sample document.pdf')

  await user.click(screen.getByRole('button', { name: 'Replace' }))
  const replaceInput = screen.getByLabelText('Replace attachment file')
  await user.upload(
    replaceInput,
    new File(['%PDF-1.5'], 'updated-sample.pdf', { type: 'application/pdf' }),
  )

  await screen.findByText('updated-sample.pdf')
  expect(screen.getByText('v2')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Versions' }))
  const versionList = await screen.findByRole('list', {
    name: 'Attachment versions',
  })
  const rows = within(versionList).getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent('v2')
  expect(rows[0]).toHaveTextContent('Current')
  expect(rows[1]).toHaveTextContent('v1')
  expect(within(rows[1]).queryByText('Current')).toBeNull()
})

it('deletes via confirm dialog and hides Upload/Replace/Delete when read-only', async () => {
  const first = await renderAttachmentsTab(1, true)
  const user = userEvent.setup()
  await screen.findByText('Sample document.pdf')

  await user.click(screen.getByRole('button', { name: 'Delete' }))
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Delete attachment?' }),
  )
  await user.click(dialog.getByRole('button', { name: 'Delete file' }))
  await screen.findByText('No attachments yet.')
  expect(screen.queryByText('Sample document.pdf')).toBeNull()
  first.unmount()

  await renderAttachmentsTab(2, false)
  await screen.findByText('Sample document.pdf')
  expect(screen.getByText('This document is read-only.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Preview' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Download' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Versions' })).toBeVisible()
  expect(screen.queryByLabelText(/Upload attachment/i)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
})

it('previews PDF (iframe) and PNG (img), refreshes expired links, and supports light dismiss', async () => {
  await renderAttachmentsTab(1, true)
  const user = userEvent.setup()
  await screen.findByText('Sample document.pdf')

  let urlCalls = 0
  documentServer.use(
    http.get('/api/documents/1/attachments/1/url', () => {
      urlCalls++
      return HttpResponse.json({
        url: 'data:application/pdf;base64,JVBERg==',
        expiresAt:
          urlCalls === 1
            ? new Date(Date.now() - 1000).toISOString()
            : new Date(Date.now() + 300_000).toISOString(),
        expiresInSeconds: 300,
        disposition: 'inline',
      })
    }),
  )

  await user.click(screen.getByRole('button', { name: 'Preview' }))
  const dialogEl = await screen.findByRole('dialog', {
    name: /Sample document\.pdf/,
  })
  const dialog = within(dialogEl)
  expect(await dialog.findByText('Link expired')).toBeVisible()

  await user.click(dialog.getByRole('button', { name: 'Refresh link' }))
  const iframe = await dialog.findByTitle('Sample document.pdf')
  expect(dialog.getByRole('status')).toHaveTextContent(/Link expires in/)
  expect(iframe.tagName).toBe('IFRAME')
  expect(iframe).toHaveAttribute(
    'src',
    expect.stringMatching(/^data:application\/pdf/),
  )
  expect(dialog.getByRole('link', { name: 'Open in new tab' })).toHaveAttribute(
    'target',
    '_blank',
  )

  vi.spyOn(dialogEl, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    right: 500,
    top: 100,
    bottom: 500,
    width: 400,
    height: 400,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  })
  // Dragging from inside to outside must not dismiss.
  fireEvent(
    dialogEl,
    new MouseEvent('pointerdown', { clientX: 200, clientY: 200 }),
  )
  fireEvent(dialogEl, new MouseEvent('pointerup', { clientX: 20, clientY: 20 }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  // Clicking outside dismisses via pointer-bounds fallback.
  fireEvent(
    dialogEl,
    new MouseEvent('pointerdown', { clientX: 20, clientY: 20 }),
  )
  fireEvent(dialogEl, new MouseEvent('pointerup', { clientX: 20, clientY: 20 }))
  expect(screen.queryByRole('dialog')).toBeNull()

  documentServer.resetHandlers()
  await user.upload(
    screen.getByLabelText(/Upload attachment/i),
    new File(['png'], 'photo.png', { type: 'image/png' }),
  )
  const photoRow = (await screen.findByText('photo.png')).closest('li')!
  await user.click(within(photoRow).getByRole('button', { name: 'Preview' }))
  const imgDialog = within(
    await screen.findByRole('dialog', { name: /photo\.png/ }),
  )
  const img = await imgDialog.findByAltText('photo.png')
  expect(img.tagName).toBe('IMG')
  expect(img).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/))
  await user.click(imgDialog.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('downloads with disposition=attachment', async () => {
  await renderAttachmentsTab(1, true)
  const user = userEvent.setup()
  await screen.findByText('Sample document.pdf')

  const getUrlSpy = vi.spyOn(attachmentsApi, 'getUrl')
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  try {
    await user.click(screen.getByRole('button', { name: 'Download' }))
    await vi.waitFor(() => {
      expect(getUrlSpy).toHaveBeenCalledWith(
        1,
        1,
        'attachment',
        expect.any(AbortSignal),
      )
      expect(clickSpy).toHaveBeenCalledTimes(1)
    })
  } finally {
    getUrlSpy.mockRestore()
    clickSpy.mockRestore()
  }
})

it('shows <progress> while uploading, prevents concurrent uploads, and aborts on unmount', async () => {
  let uploadCalls = 0
  documentServer.use(
    http.post('/api/documents/1/attachments', async () => {
      uploadCalls++
      await delay(200)
      return HttpResponse.json(
        {
          id: 99,
          documentId: 1,
          fileGroupId: 'group-99',
          fileName: 'slow.pdf',
          mimeType: 'application/pdf',
          fileSize: 12,
          versionNo: 1,
          isCurrent: true,
          uploadedBy: 1,
          uploadedAt: '2026-11-23T12:00:00Z',
        },
        { status: 201 },
      )
    }),
  )
  const uploadSpy = vi.spyOn(attachmentsApi, 'upload')
  try {
    const view = await renderAttachmentsTab(1, true)
    await screen.findByText('Sample document.pdf')
    const input = screen.getByLabelText(/Upload attachment/i)
    const dropzone = input.closest('div')!

    fireEvent.change(input, {
      target: {
        files: [
          new File(['%PDF-1.4'], 'slow.pdf', { type: 'application/pdf' }),
        ],
      },
    })
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [
          new File(['%PDF-1.4'], 'second.pdf', { type: 'application/pdf' }),
        ],
      },
    })

    const progress = await screen.findByRole('progressbar', {
      name: 'Upload progress',
    })
    expect(progress).not.toHaveAttribute('value')
    expect(uploadCalls).toBe(1)

    const signal = uploadSpy.mock.calls[0][2]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
  } finally {
    uploadSpy.mockRestore()
  }
})

it('disables Download while preview loads and surfaces preview download errors inside the dialog', async () => {
  await renderAttachmentsTab(1, true)
  const user = userEvent.setup()
  await screen.findByText('Sample document.pdf')

  let releaseInline!: () => void
  const inlineGate = new Promise<void>((resolve) => {
    releaseInline = resolve
  })
  documentServer.use(
    http.get('/api/documents/1/attachments/1/url', async ({ request }) => {
      const disposition = new URL(request.url).searchParams.get('disposition')
      if (disposition === 'attachment') {
        return new HttpResponse(null, { status: 403 })
      }
      await inlineGate
      return HttpResponse.json({
        url: 'data:application/pdf;base64,JVBERg==',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        expiresInSeconds: 300,
        disposition: 'inline',
      })
    }),
  )

  await user.click(screen.getByRole('button', { name: 'Preview' }))
  const dialogEl = await screen.findByRole('dialog', {
    name: /Sample document\.pdf/,
  })
  const dialog = within(dialogEl)
  const downloadBtn = dialog.getByRole('button', { name: 'Download' })
  expect(downloadBtn).toBeDisabled()

  releaseInline()
  await dialog.findByTitle('Sample document.pdf')
  expect(downloadBtn).toBeEnabled()

  await user.click(downloadBtn)
  expect(await dialog.findByRole('alert')).toHaveTextContent(/permission/)
  expect(dialog.getByTitle('Sample document.pdf')).toBeInTheDocument()
})
