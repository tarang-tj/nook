# Capture options

> **DRAFT.** A comparison to help the team choose. No option is recommended here.

All links were read on 2026-10-10. Quoted text is copied from the linked page. "We verified" means someone on the team ran it and saw the result. "A source says" means we read it and have not tried it.

| | A. LiDAR with Apple RoomPlan | B. Camera only, with a known reference (the prototype) | C. Camera only, with a depth model |
| --- | --- | --- | --- |
| Hardware | An iPhone or iPad with a LiDAR Scanner, on iOS or iPadOS 16.0 or later. | Any phone or laptop with a camera and a browser, plus a sheet of Letter or A4 paper. | Any camera for the photo. Something has to run the model: we have not established whether that can be the phone. |
| What it gives | A 3D model of a room: walls, windows, openings, doors, and furniture such as a bed or refrigerator. Exports to USD and USDZ files. | One straight-line distance on the floor, with an error bar. | A depth value for each pixel of a photo. Turning that into room measurements is extra work nobody has scoped. |
| Known limits | Apple devices with LiDAR only. It is a framework for Apple apps, so using it means building an iOS app. We have not listed what that takes. | Flat floor only. The points must be on the same surface as the sheet. The error bar widens away from the sheet and on small screens. No heights, no walls. | We do not know its accuracy indoors, its speed on a phone, or the licence terms of any particular model. |
| We verified | Nothing. Nobody on the team has run it. | The maths passes its tests on made-up scenes. Not tried on a real phone. Not checked against a tape measure. | Nothing. |
| A source says | See "RoomPlan" below. | TJ's SPECTRA project, same method: roughly 10 to 25 percent error bar on a room-sized area with one sheet of paper. Not checked against a tape measure either. | See "Depth models" below. |

## RoomPlan (option A)

From Apple's documentation:

- Availability is listed as iOS 16.0+, iPadOS 16.0+ and Mac Catalyst 16.0+. [RoomPlan](https://developer.apple.com/documentation/roomplan)
- "The framework inspects a device's camera feed and LiDAR readings to identify walls, windows, openings, and doors. RoomPlan also recognizes room features, furniture, and appliances, such as a fireplace, bed, or refrigerator". [RoomPlan](https://developer.apple.com/documentation/roomplan)
- "The framework outputs a scan as parametric data" and "also provides the results in various Universal Scene Description (USD) formats." [RoomPlan](https://developer.apple.com/documentation/roomplan)
- Whether a device is supported: "This property is `true` if the device contains a LiDAR Scanner; otherwise, `false`." [RoomCaptureSession.isSupported](https://developer.apple.com/documentation/roomplan/roomcapturesession/issupported)
- Export: "You can export the current state of the room at any time to a USDZ file". [CapturedRoom](https://developer.apple.com/documentation/roomplan/capturedroom)
- Mac apps can open and export saved scans but cannot scan. [RoomPlan](https://developer.apple.com/documentation/roomplan)

Which iPhone and iPad models have a LiDAR Scanner is not stated on those pages. We have not looked it up.

### Is there an Android equivalent?

We did not find one. How we looked, on 2026-10-10:

- One web search for an Android or ARCore equivalent of RoomPlan. It turned up no official Google API for room scanning.
- Google's ARCore Depth API page describes depth images. It does not mention room scanning, floor plans, or detecting walls, doors or windows. [ARCore Depth API](https://developers.google.com/ar/develop/depth)
- An open feature request on Google's ARCore SDK repository, opened 2026-06-25, asks for one and says ARCore does "not have a standard high-level API comparable to Apple RoomPlan". It was written by an outside user, and it had no replies when we read it. [arcore-android-sdk issue 1772](https://github.com/google-ar/arcore-android-sdk/issues/1772)

This was a short search, not a thorough one. "We did not find one" is not the same as "there is none".

## Depth models (option C)

Two things we read. We have run neither.

- Google's ARCore Depth API gives depth from the phone's camera, and depth data becomes available once the person starts moving the device. Google says "The most accurate results come when the device is half a meter to about five meters away from the real-world scene", that it is "only supported on devices with the processing power to support depth", and that some devices also have a hardware depth sensor. We have not looked at what building with it involves. [ARCore Depth API](https://developers.google.com/ar/develop/depth)
- Depth Pro is a research model from Apple that estimates depth from a single photo. Its README says "The predictions are metric, with absolute scale, without relying on the availability of metadata such as camera intrinsics" and reports "a 2.25-megapixel depth map in 0.3 seconds on a standard GPU". That speed is for a GPU, not a phone. We have not read its licence. [apple/ml-depth-pro](https://github.com/apple/ml-depth-pro)

There are other depth models. We have not surveyed them.

## Questions the team needs to answer to choose

1. Which phones do the five of us have? Does anyone have an iPhone or iPad with LiDAR?
2. Which phones do the people we want to serve have? This comes from interviews, not from us.
3. What does a person need to get out of it: one distance, a floor plan, a 3D model? How accurate does it need to be for them to trust it?
4. Does anyone on the team want to build an iOS app, and have what that takes? Option A needs it.
5. What does the course expect us to show on Dec 9: a working app, a demo, or evidence from customers?
6. What is the course policy on AI-written code? It affects how much of any option we can build this way.
7. Is "a phone browser page" enough, or does it need to be an installed app?
8. How does option B do against a tape measure in a real room? One afternoon of testing would tell us.
