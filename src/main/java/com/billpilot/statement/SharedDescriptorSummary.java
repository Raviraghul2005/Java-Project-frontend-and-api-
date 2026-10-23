package com.billpilot.statement;

import java.util.List;

/**
 * What was found under one shared descriptor (Apple, PayPal, ...): its streams and the charges left over.
 * {@code descriptor} is the statement text of the first charge without its reference numbers ("APPLE.COM/BILL").
 */
public record SharedDescriptorSummary(String key, String label, String descriptor, int chargeCount,
                                      int subscriptionCount, int oneOffCount, double oneOffTotal,
                                      List<StreamSeparator.Leftover> oneOffs) {
}
